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
    };

    if (data.type === 'Marchand' && data.categories?.length) {
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
    return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  }

  findAll() {
    return this.prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: { categories: { select: { id: true, name: true } } },
      // plan et planExpiresAt inclus via select *
    });
  }

  // ── Liste publique des partenaires actifs (marchands/restaurants) ──
  findPublicActive() {
    return this.prisma.partner.findMany({
      where: {
        isActive: true,
        type: { in: ['Marchand', 'Restaurant'] },
        slug: { not: null },
      },
      select: {
        id: true, name: true, slug: true, type: true,
        city: true, zone: true, plan: true,
        categories: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }).then(partners => {
      console.log("partners", partners)
      const ORDER = { enterprise: 0, business: 1, pro: 2, free: 3 };
      return partners.sort((a, b) =>
        (ORDER[(a as any).plan as keyof typeof ORDER] ?? 3) - (ORDER[(b as any).plan as keyof typeof ORDER] ?? 3)
      );
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, contact: true, city: true },
    });
  }

  updatePartner(id: string, data: { isActive?: boolean }) {
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

  // Retourne les infos du partenaire depuis son token
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
    if (!pt.partner.isActive) throw new UnauthorizedException('Ce compte partenaire n\'est pas encore activé. Contactez l\'équipe Lepfila.');

    return pt.partner;
  }

  // Génère ou retourne le token existant d'un partenaire (admin only)
  async generatePortalToken(partnerId: string) {
    const existing = await this.prisma.partnerToken.findUnique({
      where: { partnerId },
    });
    if (existing) return existing;

    return this.prisma.partnerToken.create({
      data: { partnerId },
    });
  }

  // Liste tous les tokens (admin)
  async listPortalTokens() {
    return this.prisma.partnerToken.findMany({
      include: {
        partner: { select: { id: true, name: true, slug: true, isActive: true } },
      },
    });
  }
}
