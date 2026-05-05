import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePartnerProductDto } from './dto/create-partner-product.dto';
import { UpdatePartnerProductDto } from './dto/update-partner-product.dto';

@Injectable()
export class PartnerPortalService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Vérifie le token et retourne le partenaire ────────────
  private async verifyToken(token: string) {
    const pt = await this.prisma.partnerToken.findUnique({
      where: { token },
      include: {
        partner: {
          select: {
            id: true, name: true, slug: true, city: true,
            zone: true, type: true, isActive: true, contact: true,
            plan: true, planExpiresAt: true,
            profileImageUrl: true, bannerUrl: true,
          },
        },
      },
    });
    if (!pt) throw new UnauthorizedException('Token invalide ou expiré');
    if (!pt.partner.isActive) throw new UnauthorizedException("Ce partenaire n'est pas encore activé");

    // Downgrade automatique si plan expiré
    const partner = pt.partner;
    if (partner.plan !== 'free' && partner.planExpiresAt && new Date(partner.planExpiresAt) < new Date()) {
      await this.prisma.partner.update({ where: { id: partner.id }, data: { plan: 'free' } });
      partner.plan = 'free';
    }

    return partner;
  }

  // ── Profil partenaire via token ───────────────────────────
  async getPartnerByToken(token: string) {
    return this.verifyToken(token);
  }

  // ── Génère ou retourne le token d'un partenaire (admin) ───
  async getOrCreateToken(partnerId: string) {
    const existing = await this.prisma.partnerToken.findUnique({ where: { partnerId } });
    if (existing) return existing;
    return this.prisma.partnerToken.create({ data: { partnerId } });
  }

  // ── Révoque le token (admin) ──────────────────────────────
  async revokeToken(partnerId: string) {
    await this.prisma.partnerToken.deleteMany({ where: { partnerId } });
    return { ok: true };
  }

  // ── Liste produits du partenaire ──────────────────────────
  async getProducts(token: string) {
    const partner = await this.verifyToken(token);
    return this.prisma.partnerProduct.findMany({
      where: { partnerId: partner.id },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ── Produits publics (page /order?partner=slug) ───────────
  async getPublicProducts(slug: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true, name: true, city: true, contact: true,
        bannerUrl: true, profileImageUrl: true, plan: true,
      },
    });
    if (!partner) throw new NotFoundException('Partenaire introuvable');

    const products = await this.prisma.partnerProduct.findMany({
      where: { partnerId: partner.id, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return { partner, products };
  }

  // ── Créer un produit ──────────────────────────────────────
  async createProduct(dto: CreatePartnerProductDto) {
    const partner = await this.verifyToken(dto.token);

    // Limite selon le plan
    const LIMITS: Record<string, number> = {
      free: 5, pro: 999999, business: 999999, enterprise: 999999,
    };
    const max = LIMITS[partner.plan] ?? 5;
    const count = await this.prisma.partnerProduct.count({ where: { partnerId: partner.id } });
    if (count >= max) {
      throw new ConflictException(
        partner.plan === 'free'
          ? `Limite de ${max} produits atteinte. Passez au plan Pro pour des produits illimités.`
          : 'Limite atteinte.',
      );
    }

    const imageUrl = dto.imageUrl || this.generateImageUrl(dto.name);

    // Limite photos selon le plan
    const PHOTO_LIMITS: Record<string, number> = {
      free: 1, pro: 5, business: 10, enterprise: 999,
    };
    const maxPhotos = PHOTO_LIMITS[partner.plan] ?? 1;
    const imageUrls = dto.imageUrls
      ? dto.imageUrls.slice(0, maxPhotos)
      : [];

    return this.prisma.partnerProduct.create({
      data: {
        partnerId:   partner.id,
        name:        dto.name,
        price:       dto.price,
        category:    dto.category ?? 'plat',
        description: dto.description,
        imageUrl,
        imageUrls,
      },
    });
  }

  // ── Modifier un produit ───────────────────────────────────
  async updateProduct(id: string, dto: UpdatePartnerProductDto) {
    const partner = await this.verifyToken(dto.token);
    const product = await this.prisma.partnerProduct.findFirst({
      where: { id, partnerId: partner.id },
    });
    if (!product) throw new NotFoundException('Produit introuvable');

    return this.prisma.partnerProduct.update({
      where: { id },
      data: {
        ...(dto.name        !== undefined && { name: dto.name }),
        ...(dto.price       !== undefined && { price: dto.price }),
        ...(dto.category    !== undefined && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl    !== undefined && { imageUrl: dto.imageUrl || this.generateImageUrl(product.name) }),
        ...(dto.imageUrls   !== undefined && (() => {
          const PHOTO_LIMITS: Record<string, number> = { free: 1, pro: 5, business: 10, enterprise: 999 };
          const max = PHOTO_LIMITS[partner.plan] ?? 1;
          return { imageUrls: dto.imageUrls!.slice(0, max) };
        })()),
        ...(dto.isActive    !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── Toggle actif/masqué ───────────────────────────────────
  async toggleProduct(id: string, token: string, isActive: boolean) {
    const partner = await this.verifyToken(token);
    const product = await this.prisma.partnerProduct.findFirst({
      where: { id, partnerId: partner.id },
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    return this.prisma.partnerProduct.update({ where: { id }, data: { isActive } });
  }

  // ── Supprimer un produit ──────────────────────────────────
  async deleteProduct(id: string, token: string) {
    const partner = await this.verifyToken(token);
    const product = await this.prisma.partnerProduct.findFirst({
      where: { id, partnerId: partner.id },
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    await this.prisma.partnerProduct.delete({ where: { id } });
    return { ok: true };
  }

  // ── Commandes du partenaire ───────────────────────────────
  async getOrders(token: string) {
    const partner = await this.verifyToken(token);
    return this.prisma.order.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product:        { select: { id: true, name: true } },
            partnerProduct: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  // ── Mise à jour statut commande ───────────────────────────
  async updateOrderStatus(orderId: string, token: string, status: string) {
    const partner = await this.verifyToken(token);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, partnerId: partner.id },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as any },
    });

    await this.notifications.create(
      'ORDER_STATUS_CHANGED',
      `📦 Commande #${orderId.slice(-6).toUpperCase()} mise à jour`,
      `Partenaire: ${partner.name} → ${status}`,
      orderId,
    );

    return updated;
  }

  // ── Stats du partenaire (Pro+) ────────────────────────────
  async getStats(token: string) {
    const partner = await this.verifyToken(token);

    if (!['pro', 'business', 'enterprise'].includes(partner.plan)) {
      return {
        locked: true,
        plan: partner.plan,
        message: 'Les statistiques sont disponibles à partir du plan Pro (4 900 FCFA/mois).',
      };
    }

    const [totalOrders, pendingOrders, totalProducts, activeProducts] =
      await this.prisma.$transaction([
        this.prisma.order.count({ where: { partnerId: partner.id } }),
        this.prisma.order.count({ where: { partnerId: partner.id, status: 'PENDING' } }),
        this.prisma.partnerProduct.count({ where: { partnerId: partner.id } }),
        this.prisma.partnerProduct.count({ where: { partnerId: partner.id, isActive: true } }),
      ]);

    const revenue = await this.prisma.order.aggregate({
      where: { partnerId: partner.id, status: 'DELIVERED' },
      _sum: { totalPrice: true },
    });

    return {
      totalOrders,
      pendingOrders,
      totalProducts,
      activeProducts,
      totalRevenue: revenue._sum.totalPrice ?? 0,
    };
  }

  // ── Rapport mensuel (Business+) ───────────────────────────
  async getMonthlyReport(token: string) {
    const partner = await this.verifyToken(token);

    if (!['business', 'enterprise'].includes(partner.plan)) {
      return {
        locked: true,
        plan: partner.plan,
        message: 'Le rapport mensuel est disponible à partir du plan Business (14 900 FCFA/mois).',
      };
    }

    const now = new Date();
    const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0);

    const [ordersThisMonth, ordersLastMonth, topProducts] = await Promise.all([
      this.prisma.order.findMany({
        where: { partnerId: partner.id, createdAt: { gte: startOfMonth } },
        select: { totalPrice: true, status: true, createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { partnerId: partner.id, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        select: { totalPrice: true, status: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['partnerProductId'],
        where: { order: { partnerId: partner.id, createdAt: { gte: startOfMonth } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const rev    = (orders: any[]) => orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalPrice, 0);
    const thisM  = rev(ordersThisMonth);
    const lastM  = rev(ordersLastMonth);
    const growth = lastM > 0 ? Math.round(((thisM - lastM) / lastM) * 100) : (thisM > 0 ? 100 : 0);

    const hourCounts: Record<number, number> = {};
    ordersThisMonth.forEach(o => {
      const h = new Date(o.createdAt).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const peakEntry = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];

    return {
      locked: false,
      period: startOfMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      partner: { name: partner.name, plan: partner.plan },
      revenue: { thisMonth: thisM, lastMonth: lastM, growth },
      orders: {
        total:     ordersThisMonth.length,
        delivered: ordersThisMonth.filter(o => o.status === 'DELIVERED').length,
        pending:   ordersThisMonth.filter(o => o.status === 'PENDING').length,
        cancelled: ordersThisMonth.filter(o => o.status === 'CANCELLED').length,
      },
      peakHour:    peakEntry ? `${peakEntry[0]}h–${+peakEntry[0] + 1}h` : null,
      topProducts,
    };
  }

  // ── URL image via Pollinations ────────────────────────────
  private generateImageUrl(name: string): string {
    const prompt = encodeURIComponent(
      `${name}, Sénégal, cuisine africaine, photographie professionnelle appétissante, fond blanc`,
    );
    return `https://image.pollinations.ai/prompt/${prompt}?width=400&height=300&nologo=true`;
  }
}
