import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) { }

  // ─── Résoudre un partnerToken → partnerId ──────────────────
  private async resolvePartner(partnerToken: string) {
    if (!partnerToken) throw new BadRequestException('partnerToken requis');
    const pt = await this.prisma.partnerToken.findUnique({
      where: { token: partnerToken },
      include: { partner: true },
    });
    if (!pt) throw new ForbiddenException('Token invalide');
    if (!pt.partner.isActive) throw new ForbiddenException('Compte inactif');
    if (pt.partner.type !== 'Prestataire')
      throw new ForbiddenException('Réservé aux prestataires');
    return pt.partner;
  }

  // ─── PUBLIC ────────────────────────────────────────────────

  async create(dto: CreateServiceRequestDto) {
    const req = await this.prisma.serviceRequest.create({ data: dto });
    await this.notifications.create(
      'NEW_SERVICE_REQUEST',
      `🔧 Nouveau service : ${dto.service}`,
      `${dto.quarter}, ${dto.city}${dto.customerName ? ' — ' + dto.customerName : ''}`,
      req.id,
    );
    return req;
  }

  getPublic() {
    return this.prisma.serviceRequest.findMany({
      where: { status: 'PENDING', assignedPartnerId: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, service: true, serviceIcon: true, city: true, quarter: true, description: true, createdAt: true },
      // customerName et customerPhone EXCLUS
    });
  }

  /** Missions PENDING non assignées — sans infos client */
  async getOpen(partnerToken: string) {
    const partner = await this.resolvePartner(partnerToken);

    const requests = await this.prisma.serviceRequest.findMany({
      where: {
        status: 'PENDING',
        assignedPartnerId: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        service: true,
        serviceIcon: true,
        city: true,
        quarter: true,
        description: true,
        budget: true,
        status: true,
        createdAt: true,
        // customerName et customerPhone EXCLUS intentionnellement
        _count: { select: { interests: true } },
      },
    });

    // Ajouter le nombre d'intérêts dans chaque mission
    return requests.map((r) => ({
      ...r,
      interestCount: r._count.interests,
      _count: undefined,
    }));
  }

  /** Missions assignées à CE prestataire — avec infos client */
  async getAssigned(partnerToken: string) {
    const partner = await this.resolvePartner(partnerToken);

    return this.prisma.serviceRequest.findMany({
      where: { assignedPartnerId: partner.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        service: true,
        serviceIcon: true,
        city: true,
        quarter: true,
        description: true,
        budget: true,
        status: true,
        customerName: true,   // ✅ visible car assigné
        customerPhone: true,  // ✅ visible car assigné
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** IDs des missions où ce prestataire a exprimé un intérêt */
  async getMyInterests(partnerToken: string) {
    const partner = await this.resolvePartner(partnerToken);

    const interests = await this.prisma.serviceInterest.findMany({
      where: { partnerId: partner.id },
      select: { requestId: true },
    });

    return interests.map((i) => ({ requestId: i.requestId, id: i.requestId }));
  }

  /** Exprimer un intérêt */
  async expressInterest(requestId: string, partnerToken: string) {
    const partner = await this.resolvePartner(partnerToken);

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Mission introuvable');
    if (request.status !== 'PENDING')
      throw new BadRequestException('Cette mission n\'est plus disponible');

    // Upsert — idempotent si déjà exprimé
    const interest = await this.prisma.serviceInterest.upsert({
      where: { requestId_partnerId: { requestId, partnerId: partner.id } },
      create: { requestId, partnerId: partner.id },
      update: {},
    });

    // Notifier l'admin
    await this.notifications.create(
      'SERVICE_INTEREST',
      `🙋 ${partner.name} est intéressé`,
      `Pour la mission : ${request.service} — ${request.quarter}, ${request.city}`,
      requestId,
    );

    return { success: true, interest };
  }

  // ─── ADMIN ─────────────────────────────────────────────────

  /** Toutes les demandes avec compte des intérêts */
  async findAll() {
    const requests = await this.prisma.serviceRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { interests: true } },
        assignedPartner: {
          select: { id: true, name: true },
        },
      },
    });

    return requests.map((r) => ({
      ...r,
      interestCount: r._count.interests,
      _count: undefined,
    }));
  }

  /** Prestataires intéressés pour une mission (admin) */
  async getInterests(requestId: string) {
    const interests = await this.prisma.serviceInterest.findMany({
      where: { requestId },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            city: true,
            zone: true,
            contact: true,
            profileImageUrl: true,
            serviceCategories: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return interests.map((i) => i.partner);
  }

  /** Affecter une mission à un prestataire (admin) */
  async assign(requestId: string, partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) throw new NotFoundException('Prestataire introuvable');

    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: 'ASSIGNED',
        assignedPartnerId: partnerId,
        assignedPartnerName: partner.name,
      },
    });

    // Notifier le prestataire assigné
    await this.notifications.create(
      'MISSION_ASSIGNED',
      `🎯 Mission assignée à ${partner.name}`,
      `Mission : ${updated.service} — ${updated.quarter}, ${updated.city}`,
      requestId,
    );

    return updated;
  }

  /** Changer le statut */
  async updateStatus(id: string, status: string, partnerToken?: string) {
    // Si appel depuis le portail prestataire, vérifier qu'il est bien assigné
    if (partnerToken) {
      const partner = await this.resolvePartner(partnerToken);
      const req = await this.prisma.serviceRequest.findUnique({ where: { id } });
      if (!req) throw new NotFoundException('Mission introuvable');
      if (req.assignedPartnerId !== partner.id)
        throw new ForbiddenException('Vous n\'êtes pas assigné à cette mission');
    }

    return this.prisma.serviceRequest.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
