import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
  ) { }

  async create(dto: CreateOrderDto) {
    const order = await this.prisma.order.create({
      data: {
        city: dto.city,
        quarter: dto.quarter,
        deliveryFee: dto.deliveryFee,
        totalPrice: dto.totalPrice,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        note: dto.note,
        partnerId: dto.partnerId ?? null,
        items: {
          create: dto.items.map((i) => {
            const isPartner = i.partnerProductId || String(i.productId) === 'partner';
            return {
              // Si produit partenaire, ne pas lier à la table Product
              ...(isPartner ? {} : { productId: String(i.productId) }),
              partnerProductId: i.partnerProductId ? String(i.partnerProductId) : undefined,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            };
          }),
        },
      },
      include: { items: { include: { product: true } }, partner: { include: { token: true } } },
    });

    await this.notifications.create(
      'NEW_ORDER',
      '🛒 Nouvelle commande',
      `${dto.items.length} article(s) — ${dto.totalPrice.toLocaleString()} FCFA · ${dto.quarter}, ${dto.city}`,
      order.id,
    );

    // Email au partenaire si email disponible
    if (order.partner && (order.partner as any).email) {
      const partnerEmail = (order.partner as any).email;
      const tokenRecord = await this.prisma.partnerToken.findUnique({
        where: { partnerId: order.partner.id },
      });
      const itemsList = dto.items.map((i) => ({
        name: i.name || 'Produit',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));
      this.email.sendNouvelleCommande(partnerEmail, order.partner.name, {
        id: order.id,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        quarter: dto.quarter,
        city: dto.city,
        totalPrice: dto.totalPrice,
        items: itemsList,
        portalToken: tokenRecord?.token,
      }).catch((e) => this.logger.warn('Email commande: ' + e.message));
    }

    return order;
  }

  // findAll avec filtre partner optionnel
  async findAll(partnerId?: string) {
    const where: any = {};
    if (partnerId) where.partnerId = partnerId;

    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true, partnerProduct: true } },
        partner: { select: { id: true, name: true } },
      },
    });
  }

  // Filtre par partnerToken (pour le portal)
  async findByPartnerToken(token: string) {
    const pt = await this.prisma.partnerToken.findUnique({ where: { token } });
    if (!pt) return [];
    return this.findAll(pt.partnerId);
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, partnerProduct: true } },
        partner: { select: { id: true, name: true, contact: true } },
      },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.notifications.create(
      'ORDER_STATUS_CHANGED',
      '📦 Statut mis à jour',
      `Commande #${id.slice(-6).toUpperCase()} → ${dto.status}`,
      id,
    );

    return order;
  }

  stats() {
    return this.prisma.$transaction([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.aggregate({ _sum: { totalPrice: true } }),
    ]);
  }
}