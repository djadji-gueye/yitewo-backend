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
            profileImageUrl: true, bannerUrl: true, address: true, lat: true, lng: true,
          },
        },
      },
    });
    if (!pt) throw new UnauthorizedException('Token invalide ou expiré');
    if (!pt.partner.isActive) throw new UnauthorizedException('Ce partenaire n\'est pas encore activé');
    return pt.partner;
  }

  // ── Profil partenaire via token (pour le portal) ──────────
  async getPartnerByToken(token: string) {
    return this.verifyToken(token);
  }

  // ── Génère ou retourne le token d'un partenaire (admin) ───
  async getOrCreateToken(partnerId: string) {
    const existing = await this.prisma.partnerToken.findUnique({
      where: { partnerId },
    });
    if (existing) return existing;

    return this.prisma.partnerToken.create({
      data: { partnerId },
    });
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

  // ── Produits publics (pour /order?partner=slug) ───────────
  async getPublicProducts(slug: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, city: true, contact: true },
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

    // Limite : max 50 produits par partenaire
    const count = await this.prisma.partnerProduct.count({
      where: { partnerId: partner.id },
    });
    if (count >= 50) {
      throw new ConflictException('Limite de 50 produits atteinte');
    }

    // Image par défaut via Pollinations si non fournie
    const imageUrl = dto.imageUrl || this.generateImageUrl(dto.name);

    return this.prisma.partnerProduct.create({
      data: {
        partnerId:   partner.id,
        name:        dto.name,
        price:       dto.price,
        category:    dto.category ?? 'plat',
        description: dto.description,
        imageUrl,
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
        ...(dto.name        && { name: dto.name }),
        ...(dto.price       && { price: dto.price }),
        ...(dto.category    && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl    !== undefined && { imageUrl: dto.imageUrl || this.generateImageUrl(product.name) }),
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

    return this.prisma.partnerProduct.update({
      where: { id },
      data: { isActive },
    });
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
          },
        },
      },
    });
  }

  // ── Mise à jour statut commande (partner) ─────────────────
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

  // ── Stats du partenaire ───────────────────────────────────
  async getStats(token: string) {
    const partner = await this.verifyToken(token);

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


  // ── Mise à jour profil partenaire ────────────────────────
  async updateProfile(token: string, data: {
    zone?: string; city?: string;
    profileImageUrl?: string; bannerUrl?: string;
    address?: string; lat?: number; lng?: number;
  }) {
    const partner = await this.verifyToken(token);
    return this.prisma.partner.update({
      where: { id: partner.id },
      data: {
        ...(data.zone            !== undefined && { zone: data.zone }),
        ...(data.city            !== undefined && { city: data.city }),
        ...(data.profileImageUrl !== undefined && { profileImageUrl: data.profileImageUrl }),
        ...(data.bannerUrl       !== undefined && { bannerUrl: data.bannerUrl }),
        ...(data.address         !== undefined && { address: data.address }),
        ...(data.lat             !== undefined && { lat: data.lat }),
        ...(data.lng             !== undefined && { lng: data.lng }),
      },
      select: {
        id: true, name: true, slug: true, city: true, zone: true,
        type: true, contact: true, isActive: true,
        profileImageUrl: true, bannerUrl: true,
        address: true, lat: true, lng: true,
      },
    });
  }

  // ── Génère URL image via Pollinations (sans stockage) ─────
  private generateImageUrl(name: string): string {
    const prompt = encodeURIComponent(
      `${name}, Sénégal, cuisine africaine, photographie professionnelle appétissante, fond blanc`
    );
    return `https://image.pollinations.ai/prompt/${prompt}?width=400&height=300&nologo=true`;
  }
}
