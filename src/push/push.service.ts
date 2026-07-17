import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushOwnerType } from '@prisma/client';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;       // deep-link à ouvrir au clic (ex: /partner-portal/TOKEN/commandes)
  tag?: string;        // regroupe les notifs similaires (ex: "order-123")
  icon?: string;
  data?: Record<string, any>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(private prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:contact@yitewo.com';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
    } else {
      this.logger.warn(
        '⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquants — push notifications désactivées. ' +
        'Génère-les avec `npx web-push generate-vapid-keys`.',
      );
    }
  }

  getPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY || null, enabled: this.enabled };
  }

  // ── Abonnement ──────────────────────────────────────────

  async subscribe(
    ownerType: PushOwnerType,
    ownerId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    userAgent?: string,
    label?: string,
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { ownerType, ownerId, endpoint, p256dh, auth, userAgent, label },
      update: { ownerType, ownerId, p256dh, auth, userAgent, label, isActive: true, lastSeenAt: new Date() },
    });
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  // Résout un Partner depuis son token de portail (partner-portal & prestataire-portal)
  async resolvePartnerIdFromToken(token: string): Promise<string | null> {
    const record = await this.prisma.partnerToken.findUnique({ where: { token } });
    return record?.partnerId ?? null;
  }

  // ── Envoi ───────────────────────────────────────────────

  async sendToOwner(ownerType: PushOwnerType, ownerId: string, payload: PushPayload) {
    if (!this.enabled) return { sent: 0, failed: 0 };

    const subs = await this.prisma.pushSubscription.findMany({
      where: { ownerType, ownerId, isActive: true },
    });
    return this.dispatch(subs, payload);
  }

  async sendToPartner(partnerId: string, payload: PushPayload) {
    return this.sendToOwner(PushOwnerType.PARTNER, partnerId, payload);
  }

  async sendToAdmins(payload: PushPayload) {
    if (!this.enabled) return { sent: 0, failed: 0 };
    const subs = await this.prisma.pushSubscription.findMany({
      where: { ownerType: PushOwnerType.ADMIN, isActive: true },
    });
    return this.dispatch(subs, payload);
  }

  private async dispatch(
    subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
    payload: PushPayload,
  ) {
    let sent = 0;
    let failed = 0;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              url: payload.url || '/',
              tag: payload.tag,
              icon: payload.icon || '/icons/icon-192.png',
              data: payload.data || {},
            }),
          );
          sent++;
        } catch (err: any) {
          failed++;
          // 404/410 = abonnement expiré ou révoqué côté navigateur → on le supprime
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
          } else {
            this.logger.warn(`Push échoué (${sub.endpoint.slice(0, 40)}...): ${err?.message}`);
          }
        }
      }),
    );

    return { sent, failed };
  }
}
