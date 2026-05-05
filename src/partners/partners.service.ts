import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePartnerDto } from './dto/create-partner.dto';

const PLAN_ORDER: Record<string, number> = {
  enterprise: 0, business: 1, pro: 2, free: 3,
};

@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Création partenaire ────────────────────────────────────
  async create(data: CreatePartnerDto) {
    let slug: string | undefined;

    if ((data.type === 'Marchand' || data.type === 'Restaurant') && !data.slug) {
      slug = this.generateSlug(data.name);
    } else if (data.slug) {
      slug = data.slug;
    }

    if (slug) {
      const exists = await this.prisma.partner.findUnique({ where: { slug } });
      if (exists) throw new BadRequestException('Ce nom est déjà utilisé par un partenaire existant.');
    }

    const partnerData: any = {
      type: data.type,
      name: data.name,
      city: data.city,
      zone: data.zone,
      contact: data.contact,
      message: data.message,
      slug,
      isActive: data.isActive ?? false,
      profileImageUrl: data.profileImageUrl ?? null,
    };

    if (data.serviceCategories?.length) {
      partnerData.serviceCategories = data.serviceCategories;
    }

    if (data.categories?.length) {
      partnerData.categories = { connect: data.categories.map((id) => ({ id })) };
    }

    const partner = await this.prisma.partner.create({ data: partnerData });

    await this.notifications.create(
      'NEW_PARTNER',
      `🤝 Nouveau partenaire : ${data.name}`,
      `Type : ${data.type} · Ville : ${data.city} · Contact : ${data.contact}`,
      partner.id,
    );

    return partner;
  }

  private generateSlug(name: string): string {
    return name.toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '');
  }

  // ── Admin : liste complète ─────────────────────────────────
  findAll() {
    return this.prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        categories: { select: { id: true, name: true } },
        reviews:    { select: { rating: true } },
        promos:     { where: { isActive: true, endsAt: { gt: new Date() } }, take: 1 },
      },
    });
  }

  // ── Public : Boutiques & Restaurants (page /order) ─────────
  // Tri : business > pro > free, puis par nom
  async findPublicShop() {
    const partners = await this.prisma.partner.findMany({
      where: {
        isActive: true,
        type: { in: ['Marchand', 'Restaurant'] },
        slug: { not: null },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        city: true,
        zone: true,
        address: true,
        lat: true,
        lng: true,
        bannerUrl: true,
        profileImageUrl: true,
        plan: true,
        categories: { select: { name: true } },
        reviews:    { select: { rating: true } },
        promos: {
          where: { isActive: true, endsAt: { gt: new Date() } },
          select: { title: true, discount: true, endsAt: true },
          take: 1,
        },
        _count: { select: { followers: true } },
      },
    });

    // Tri SQL-side impossible sur champ custom — tri stable en mémoire O(n log n)
    return partners
      .map(p => ({
        ...p,
        avgRating: p.reviews.length
          ? Math.round((p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length) * 10) / 10
          : null,
        reviewCount: p.reviews.length,
        activePromo: p.promos[0] ?? null,
        followerCount: p._count.followers,
      }))
      .sort((a, b) => {
        const pa = PLAN_ORDER[a.plan] ?? 3;
        const pb = PLAN_ORDER[b.plan] ?? 3;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name, 'fr');
      });
  }

  // ── Public : Prestataires (page /services) ─────────────────
  async findPublicActive() {
    const partners = await this.prisma.partner.findMany({
      where: { isActive: true, type: 'Prestataire' },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        zone: true,
        contact: true,
        message: true,
        serviceCategories: true,
        profileImageUrl: true,
        plan: true,
        reviews: { select: { rating: true } },
        _count: { select: { followers: true } },
      },
    });

    return partners
      .map(p => ({
        ...p,
        avgRating: p.reviews.length
          ? Math.round((p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length) * 10) / 10
          : null,
        reviewCount: p.reviews.length,
      }))
      .sort((a, b) => {
        const pa = PLAN_ORDER[a.plan] ?? 3;
        const pb = PLAN_ORDER[b.plan] ?? 3;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name, 'fr');
      });
  }

  // ── Public : pour la carte ─────────────────────────────────
  async findForMap() {
    return this.prisma.partner.findMany({
      where: {
        isActive: true,
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true, name: true, type: true, slug: true,
        lat: true, lng: true, city: true, zone: true,
        plan: true, profileImageUrl: true,
        categories: { select: { name: true } },
      },
    });
  }

  // ── Par slug ───────────────────────────────────────────────
  async findBySlug(slug: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true, name: true, contact: true, city: true, zone: true,
        address: true, lat: true, lng: true,
        bannerUrl: true, profileImageUrl: true,
        plan: true, planExpiresAt: true,
        type: true, slug: true,
        categories: { select: { id: true, name: true } },
        reviews: {
          select: { rating: true, comment: true, name: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        promos: {
          where: { isActive: true, endsAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        _count: { select: { followers: true } },
      },
    });

    if (!partner) return null;

    const avgRating = partner.reviews.length
      ? Math.round((partner.reviews.reduce((s, r) => s + r.rating, 0) / partner.reviews.length) * 10) / 10
      : null;

    return { ...partner, avgRating, reviewCount: partner.reviews.length };
  }

  // ── Update (admin) ─────────────────────────────────────────
  updatePartner(id: string, data: {
    isActive?: boolean;
    profileImageUrl?: string;
    plan?: string;
    planExpiresAt?: Date;
    bannerUrl?: string;
  }) {
    return this.prisma.partner.update({ where: { id }, data });
  }

  // ── Produits publics d'un partenaire ───────────────────────
  async getPublicProducts(slug: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true, name: true, city: true, contact: true, slug: true,
        bannerUrl: true, profileImageUrl: true, plan: true,
        promos: {
          where: { isActive: true, endsAt: { gt: new Date() } },
          take: 1,
        },
      },
    });
    if (!partner) return { partner: null, products: [] };

    const products = await this.prisma.partnerProduct.findMany({
      where: { partnerId: partner.id, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return { partner, products };
  }

  // ── Portal token ───────────────────────────────────────────
  async findByPortalToken(token: string) {
    const pt = await this.prisma.partnerToken.findUnique({
      where: { token },
      include: {
        partner: {
          select: {
            id: true, name: true, slug: true, type: true,
            city: true, zone: true, contact: true, isActive: true,
            plan: true, planExpiresAt: true,
            profileImageUrl: true, bannerUrl: true,
            serviceCategories: true,
          },
        },
      },
    });

    if (!pt) throw new NotFoundException('Token invalide ou expiré');
    if (!pt.partner.isActive) {
      throw new UnauthorizedException(
        "Ce compte partenaire n'est pas encore activé. Contactez l'équipe Yitewo."
      );
    }

    return pt.partner;
  }

  async generatePortalToken(partnerId: string) {
    const existing = await this.prisma.partnerToken.findUnique({ where: { partnerId } });
    if (existing) return existing;
    return this.prisma.partnerToken.create({ data: { partnerId } });
  }

  async listPortalTokens() {
    return this.prisma.partnerToken.findMany({
      include: {
        partner: { select: { id: true, name: true, slug: true, isActive: true, plan: true } },
      },
    });
  }
}
