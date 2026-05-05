import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class SocialService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappService,
  ) {}

  // ── FOLLOW ────────────────────────────────────────────────

  async followPartner(slug: string, phone: string, name?: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true },
    });
    if (!partner) throw new NotFoundException('Boutique introuvable');

    // Upsert — si déjà suivi, ne pas créer en doublon
    await this.prisma.partnerFollow.upsert({
      where: { partnerId_phone: { partnerId: partner.id, phone } },
      create: { partnerId: partner.id, phone, name },
      update: { name },
    });

    const count = await this.prisma.partnerFollow.count({
      where: { partnerId: partner.id },
    });
    return { following: true, followers: count };
  }

  async unfollowPartner(slug: string, phone: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!partner) throw new NotFoundException('Boutique introuvable');

    await this.prisma.partnerFollow.deleteMany({
      where: { partnerId: partner.id, phone },
    });

    const count = await this.prisma.partnerFollow.count({
      where: { partnerId: partner.id },
    });
    return { following: false, followers: count };
  }

  async getFollowStatus(slug: string, phone: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!partner) return { following: false, followers: 0 };

    const [follow, count] = await Promise.all([
      this.prisma.partnerFollow.findUnique({
        where: { partnerId_phone: { partnerId: partner.id, phone } },
      }),
      this.prisma.partnerFollow.count({ where: { partnerId: partner.id } }),
    ]);

    return { following: !!follow, followers: count };
  }

  async getFollowersCount(partnerId: string) {
    return this.prisma.partnerFollow.count({ where: { partnerId } });
  }

  // ── REVIEWS ───────────────────────────────────────────────

  async addReview(slug: string, data: {
    rating: number;
    comment?: string;
    phone?: string;
    name?: string;
    orderId?: string;
  }) {
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('La note doit être entre 1 et 5');
    }

    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!partner) throw new NotFoundException('Boutique introuvable');

    // Un seul avis par commande
    if (data.orderId) {
      const existing = await this.prisma.partnerReview.findUnique({
        where: { orderId: data.orderId },
      });
      if (existing) throw new BadRequestException('Vous avez déjà noté cette commande');
    }

    return this.prisma.partnerReview.create({
      data: {
        partnerId: partner.id,
        rating:    data.rating,
        comment:   data.comment,
        phone:     data.phone,
        name:      data.name,
        orderId:   data.orderId,
      },
    });
  }

  async getReviews(slug: string, limit = 10) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!partner) return { reviews: [], avgRating: 0, total: 0 };

    const [reviews, agg] = await Promise.all([
      this.prisma.partnerReview.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.partnerReview.aggregate({
        where: { partnerId: partner.id },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    return {
      reviews,
      avgRating: Math.round((agg._avg.rating || 0) * 10) / 10,
      total: agg._count.id,
    };
  }

  // ── PROMOS ────────────────────────────────────────────────

  async createPromo(token: string, data: {
    title: string;
    description?: string;
    discount?: number;
    endsAt: string;
  }) {
    const pt = await this.prisma.partnerToken.findUnique({
      where: { token },
      include: { partner: { select: { id: true, isActive: true, plan: true, planExpiresAt: true } } },
    });
    if (!pt || !pt.partner.isActive) throw new NotFoundException('Token invalide');

    // Vérifier expiration plan
    const effectivePlan = (pt.partner.plan !== 'free' && pt.partner.planExpiresAt && new Date(pt.partner.planExpiresAt) < new Date())
      ? 'free' : pt.partner.plan;

    if (!['pro', 'business', 'enterprise'].includes(effectivePlan)) {
      throw new BadRequestException('Les promos flash sont disponibles à partir du plan Pro (4 900 FCFA/mois).');
    }

    // Désactiver les anciennes promos actives
    await this.prisma.partnerPromo.updateMany({
      where: { partnerId: pt.partner.id, isActive: true },
      data: { isActive: false },
    });

    return this.prisma.partnerPromo.create({
      data: {
        partnerId:   pt.partner.id,
        title:       data.title,
        description: data.description,
        discount:    data.discount,
        endsAt:      new Date(data.endsAt),
        isActive:    true,
      },
    });
  }

  async deletePromo(id: string, token: string) {
    const pt = await this.prisma.partnerToken.findUnique({
      where: { token },
      include: { partner: { select: { id: true } } },
    });
    if (!pt) throw new NotFoundException('Token invalide');

    await this.prisma.partnerPromo.deleteMany({
      where: { id, partnerId: pt.partner.id },
    });
    return { ok: true };
  }

  async getActivePromos() {
    return this.prisma.partnerPromo.findMany({
      where: {
        isActive: true,
        endsAt: { gt: new Date() },
      },
      include: {
        partner: {
          select: { id: true, name: true, slug: true, type: true, profileImageUrl: true, city: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async getPartnerPromo(slug: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!partner) return null;

    return this.prisma.partnerPromo.findFirst({
      where: {
        partnerId: partner.id,
        isActive: true,
        endsAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── PUSH NOTIFICATIONS AUX FOLLOWERS (Business+) ─────────
  async notifyFollowers(token: string, message: string) {
    // Vérifier le partenaire et son plan
    const pt = await this.prisma.partnerToken.findUnique({
      where: { token },
      include: { partner: { select: { id: true, name: true, slug: true, isActive: true, plan: true, planExpiresAt: true } } },
    });
    if (!pt || !pt.partner.isActive) throw new NotFoundException('Token invalide');

    const effectivePlan = (pt.partner.plan !== 'free' && pt.partner.planExpiresAt && new Date(pt.partner.planExpiresAt) < new Date())
      ? 'free' : pt.partner.plan;

    if (!['business', 'enterprise'].includes(effectivePlan)) {
      throw new BadRequestException('Les notifications push sont disponibles à partir du plan Business (14 900 FCFA/mois).');
    }

    const followers = await this.prisma.partnerFollow.findMany({
      where: { partnerId: pt.partner.id },
      select: { phone: true, name: true },
    });

    // Envoi WhatsApp à chaque follower
    const text = `📣 *${pt.partner.name}*\n\n${message}\n\n_Via Yitewo — yitewo.com/shop/${pt.partner.slug}_`;
    const results = await Promise.allSettled(
      followers.map(f => this.whatsapp.sendMessage(f.phone, text))
    );
    const sent = results.filter(r => r.status === 'fulfilled').length;

    return {
      sent,
      total: followers.length,
      partner: pt.partner.name,
      message,
    };
  }


  async getPartnerStats(slug: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!partner) return null;

    const [followers, agg] = await Promise.all([
      this.prisma.partnerFollow.count({ where: { partnerId: partner.id } }),
      this.prisma.partnerReview.aggregate({
        where: { partnerId: partner.id },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    return {
      followers,
      avgRating: Math.round((agg._avg.rating || 0) * 10) / 10,
      reviewCount: agg._count.id,
      badge: this.getBadge(followers, agg._avg.rating || 0, agg._count.id),
    };
  }

  private getBadge(followers: number, avgRating: number, reviewCount: number): string | null {
    if (avgRating >= 4.5 && reviewCount >= 10) return 'top';
    if (followers >= 50) return 'popular';
    if (reviewCount >= 5) return 'trusted';
    return null;
  }
}
