import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSubscriptionDto, RecordPaymentDto, ReportPaymentDto } from './dto/create-subscription.dto';

const PLAN_PRICES: Record<string, { mensuel: number; annuel: number }> = {
  free:       { mensuel: 0,      annuel: 0 },
  pro:        { mensuel: 4900,   annuel: 49000 },
  business:   { mensuel: 14900,  annuel: 149000 },
  enterprise: { mensuel: 49000,  annuel: 490000 },
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Admin : créer/activer un abonnement ──────────────────────────
  async createSubscription(dto: CreateSubscriptionDto) {
    const partner = await this.prisma.partner.findUnique({ where: { id: dto.partnerId } });
    if (!partner) throw new NotFoundException('Partenaire introuvable');

    const billing = dto.billing || 'mensuel';
    const months = billing === 'annuel' ? 12 : 1;
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);

    // Désactiver l'ancien abonnement actif s'il existe
    await this.prisma.subscription.updateMany({
      where: { partnerId: dto.partnerId, isActive: true },
      data: { isActive: false },
    });

    // Créer le nouvel abonnement
    const sub = await this.prisma.subscription.create({
      data: {
        partnerId: dto.partnerId,
        plan: dto.plan,
        billing,
        endDate,
        isActive: true,
        notes: dto.notes,
      },
    });

    // Mettre à jour le plan sur le Partner
    await this.prisma.partner.update({
      where: { id: dto.partnerId },
      data: { plan: dto.plan, planExpiresAt: endDate },
    });

    // Notification admin
    const price = PLAN_PRICES[dto.plan]?.[billing] || 0;
    await this.notifications.create(
      'NEW_PARTNER' as any,
      `💳 Plan activé : ${dto.plan.toUpperCase()} — ${partner.name}`,
      `Partenaire : ${partner.name} · Plan : ${dto.plan} · ${billing} · ${price.toLocaleString('fr-FR')} FCFA`,
      partner.id,
    );

    return sub;
  }

  // ── Admin : enregistrer un paiement Wave/OM ──────────────────────
  async recordPayment(dto: RecordPaymentDto) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: dto.subscriptionId },
      include: { partner: true },
    });
    if (!sub) throw new NotFoundException('Abonnement introuvable');

    return this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: dto.subscriptionId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        notes: dto.notes,
        status: 'pending',
      },
    });
  }

  // ── Admin : confirmer un paiement ───────────────────────────────
  async confirmPayment(paymentId: string, adminEmail: string, notes?: string) {
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { partner: true } } },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (payment.status === 'confirmed') throw new BadRequestException('Paiement déjà confirmé');

    await this.prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { status: 'confirmed', paidAt: new Date(), confirmedBy: adminEmail, notes },
    });

    // Activer automatiquement l'abonnement si pas encore actif
    const sub = payment.subscription;
    if (!sub.isActive) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { isActive: true },
      });
      await this.prisma.partner.update({
        where: { id: sub.partnerId },
        data: { plan: sub.plan, planExpiresAt: sub.endDate },
      });
    }

    await this.notifications.create(
      'NEW_PARTNER' as any,
      `✅ Paiement confirmé — ${sub.partner.name}`,
      `${payment.amount.toLocaleString('fr-FR')} FCFA · ${payment.method} · Plan ${sub.plan}`,
      sub.partnerId,
    );

    return { ok: true, message: 'Paiement confirmé et plan activé' };
  }

  // ── Public : partenaire signale son paiement ─────────────────────
  async reportPayment(dto: ReportPaymentDto) {
    const partner = await this.prisma.partner.findUnique({ where: { id: dto.partnerId } });
    if (!partner) throw new NotFoundException('Partenaire introuvable');

    const billing = dto.billing || 'mensuel';
    const price = PLAN_PRICES[dto.plan]?.[billing] || 0;

    // Créer un abonnement "en attente" + paiement pending
    const months = billing === 'annuel' ? 12 : 1;
    const endDate = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);

    const sub = await this.prisma.subscription.create({
      data: {
        partnerId: dto.partnerId,
        plan: dto.plan,
        billing,
        endDate,
        isActive: false, // pas encore confirmé
        notes: `Paiement signalé par le partenaire via ${dto.method}`,
      },
    });

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        amount: price,
        method: dto.method,
        reference: dto.reference,
        status: 'pending',
        notes: 'En attente de confirmation admin',
      },
    });

    // Notif admin
    await this.notifications.create(
      'NEW_PARTNER' as any,
      `💰 Paiement signalé — À confirmer !`,
      `${partner.name} dit avoir payé le plan ${dto.plan} (${billing}) via ${dto.method}. Réf: ${dto.reference || 'non renseignée'}`,
      partner.id,
    );

    return {
      message: 'Paiement signalé avec succès. Notre équipe confirmera sous 24h.',
      paymentId: payment.id,
      subscriptionId: sub.id,
    };
  }

  // ── Admin : révoquer / downgrader un plan ───────────────────────
  async revokePlan(partnerId: string, reason?: string) {
    await this.prisma.subscription.updateMany({
      where: { partnerId, isActive: true },
      data: { isActive: false, notes: reason || 'Révoqué par admin' },
    });
    await this.prisma.partner.update({
      where: { id: partnerId },
      data: { plan: 'free', planExpiresAt: null },
    });
    return { ok: true };
  }

  // ── Vérifier et expirer les plans échus (cron) ───────────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredPlans() {
    const expired = await this.prisma.partner.findMany({
      where: {
        plan: { not: 'free' },
        planExpiresAt: { lt: new Date() },
      },
    });

    for (const partner of expired) {
      await this.prisma.partner.update({
        where: { id: partner.id },
        data: { plan: 'free', planExpiresAt: null },
      });
      await this.prisma.subscription.updateMany({
        where: { partnerId: partner.id, isActive: true },
        data: { isActive: false, notes: 'Expiré automatiquement' },
      });
      await this.notifications.create(
        'NEW_PARTNER' as any,
        `⚠️ Plan expiré — ${partner.name}`,
        `Le plan ${partner.plan} de ${partner.name} a expiré. Repassé en Gratuit.`,
        partner.id,
      );
    }
    return { expired: expired.length };
  }

  // ── Getters ──────────────────────────────────────────────────────
  findAll() {
    return this.prisma.subscription.findMany({
      include: {
        partner: { select: { id: true, name: true, type: true, city: true, contact: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPendingPayments() {
    return this.prisma.subscriptionPayment.findMany({
      where: { status: 'pending' },
      include: {
        subscription: {
          include: {
            partner: { select: { id: true, name: true, contact: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getPartnerPlan(partnerId: string) {
    return this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        plan: true, planExpiresAt: true,
        subscriptions: {
          where: { isActive: true },
          include: { payments: { orderBy: { createdAt: 'desc' }, take: 5 } },
          take: 1,
        },
      },
    });
  }

  getStats() {
    return this.prisma.partner.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });
  }
}
