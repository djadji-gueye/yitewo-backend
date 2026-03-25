import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

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

  findAll() {
    return this.prisma.serviceRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.serviceRequest.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
