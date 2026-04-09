import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePartnerDto } from './dto/create-partner.dto';

@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) { }

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
      type: data.type, name: data.name, city: data.city,
      zone: data.zone, contact: data.contact, message: data.message,
      slug, isActive: data.isActive ?? false,
      profileImageUrl: data.profileImageUrl ?? null,
    };

    if (data.type === 'Marchand' && data.categories?.length) {
      partnerData.categories = { connect: data.categories.map((id) => ({ id })) };
    }

    if (data.type === 'Prestataire' && data.serviceCategories?.length) {
      partnerData.serviceCategories = data.serviceCategories;
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
    return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  }

  findAll() {
    return this.prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: { categories: { select: { id: true, name: true } } },
    });
  }

  // ── Liste publique marchands/restaurants (page /order) ──
  async findPublicShop() {
    const partners = await this.prisma.partner.findMany({
      where: {
        isActive: true,
        type: { in: ['Marchand', 'Restaurant'] },
        slug: { not: null },
      },
      select: {
        id: true, name: true, slug: true, type: true,
        city: true, zone: true, profileImageUrl: true,
        categories: { select: { name: true } },
        _count: { select: { followers: true } },
        reviews: {
          select: { rating: true },
        },
        promos: {
          where: { isActive: true, endsAt: { gt: new Date() } },
          select: { title: true, discount: true, endsAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return partners.map((p) => {
      const ratings = p.reviews.map((r) => r.rating);
      const avgRating = ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      const badge =
        avgRating && avgRating >= 4.5 && ratings.length >= 5 ? 'top' :
        p._count.followers >= 20 ? 'popular' :
        ratings.length >= 3 ? 'trusted' : null;

      return {
        id:             p.id,
        name:           p.name,
        slug:           p.slug,
        type:           p.type,
        city:           p.city,
        zone:           p.zone,
        profileImageUrl:p.profileImageUrl,
        categories:     p.categories,
        followers:      p._count.followers,
        avgRating,
        reviewCount:    ratings.length,
        badge,
        promo:          p.promos[0] || null,
      };
    });
  }

  // ── Liste publique prestataires actifs (page /services) ──
  findPublicActive() {
    return this.prisma.partner.findMany({
      where: {
        isActive: true,
        type: 'Prestataire',
      },
      select: {
        id: true, name: true, type: true,
        city: true, zone: true, contact: true, message: true,
        serviceCategories: true,
        profileImageUrl: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, contact: true, city: true },
    });
  }

  // ── Carte boutiques (avec coordonnées Nominatim si address présente) ──
  async findForMap() {
    const partners = await this.prisma.partner.findMany({
      where: { isActive: true, type: { in: ['Marchand', 'Restaurant'] }, slug: { not: null } },
      select: {
        id: true, name: true, slug: true, type: true,
        city: true, zone: true, address: true,
        profileImageUrl: true,
        categories: { select: { name: true } },
        _count: { select: { followers: true } },
        reviews: { select: { rating: true } },
        promos: {
          where: { isActive: true, endsAt: { gt: new Date() } },
          select: { title: true, discount: true },
          take: 1,
        },
      },
    });

    return partners.map((p) => {
      const ratings   = p.reviews.map((r) => r.rating);
      const avgRating = ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      // Coordonnées par défaut selon la ville (centroïdes approximatifs)
      const DEFAULT_COORDS: Record<string, [number, number]> = {
        'Dakar':       [14.6937, -17.4441],
        'Saint-Louis': [16.0326,  -16.4818],
        'Thiès':       [14.7910,  -16.9359],
        'Ziguinchor':  [12.5586,  -16.2719],
      };
      const [lat, lng] = DEFAULT_COORDS[p.city] || DEFAULT_COORDS['Dakar'];

      return {
        id:             p.id,
        name:           p.name,
        slug:           p.slug,
        type:           p.type,
        city:           p.city,
        zone:           p.zone,
        address:        p.address,
        profileImageUrl:p.profileImageUrl,
        categories:     p.categories,
        followers:      p._count.followers,
        avgRating,
        reviewCount:    ratings.length,
        promo:          p.promos[0] || null,
        // Coordonnées — le frontend affinera via Nominatim si address présente
        lat,
        lng,
      };
    });
  }

  updatePartner(id: string, data: { isActive?: boolean; profileImageUrl?: string }) {
    return this.prisma.partner.update({ where: { id }, data });
  }

  // ── Produits publics d'un partenaire ──────────────────────
  async getPublicProducts(slug: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, city: true, contact: true, slug: true },
    });
    if (!partner) return { partner: null, products: [] };

    const products = await this.prisma.partnerProduct.findMany({
      where: { partnerId: partner.id, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return { partner, products };
  }

  // ── Partner Portal ─────────────────────────────────────────

  async findByPortalToken(token: string) {
    const pt = await this.prisma.partnerToken.findUnique({
      where: { token },
      include: {
        partner: {
          select: {
            id: true, name: true, slug: true, type: true,
            city: true, zone: true, contact: true, isActive: true,
          },
        },
      },
    });

    if (!pt) throw new NotFoundException('Token invalide ou expiré');
    if (!pt.partner.isActive) throw new UnauthorizedException("Ce compte partenaire n'est pas encore activé. Contactez l'équipe Lepfila.");

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
        partner: { select: { id: true, name: true, slug: true, isActive: true } },
      },
    });
  }
}
