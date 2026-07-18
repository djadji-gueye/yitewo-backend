import {
  BadRequestException, Body, Controller, Get, Post, Query, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { PushOwnerType } from '@prisma/client';
import { PushService } from './push.service';
import { SubscribePushDto, UnsubscribePushDto, TestPushDto } from './dto/subscribe-push.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  @Get('vapid-public-key')
  getPublicKey() {
    return this.push.getPublicKey();
  }

  // ── Compteur de badge (resync à l'ouverture de l'app) ──────

  @Get('badge/partner')
  async getPartnerBadge(@Query('token') token: string) {
    if (!token) throw new BadRequestException('token requis');
    const partnerId = await this.push.resolvePartnerIdFromToken(token);
    if (!partnerId) throw new UnauthorizedException('Token invalide');
    return { count: await this.push.getPartnerBadgeCount(partnerId) };
  }

  @Get('badge/admin')
  @UseGuards(JwtAuthGuard)
  async getAdminBadge() {
    return { count: await this.push.getAdminBadgeCount() };
  }

  // ── Partenaires (restaurant / marchand / prestataire) ──────
  // Auth par token de portail, comme le reste du partner-portal & prestataire-portal.

  @Post('subscribe/partner')
  async subscribePartner(@Body() dto: SubscribePushDto) {
    if (!dto.token) throw new BadRequestException('token requis');
    const partnerId = await this.push.resolvePartnerIdFromToken(dto.token);
    if (!partnerId) throw new UnauthorizedException('Token invalide');

    return this.push.subscribe(
      PushOwnerType.PARTNER,
      partnerId,
      dto.endpoint,
      dto.keys.p256dh,
      dto.keys.auth,
      dto.userAgent,
      dto.label,
    );
  }

  // ── Équipe Yitewo (/dashboard) ─────────────────────────────

  @Post('subscribe/admin')
  @UseGuards(JwtAuthGuard)
  async subscribeAdmin(@Body() dto: SubscribePushDto, @CurrentUser() user: { id: string }) {
    return this.push.subscribe(
      PushOwnerType.ADMIN,
      user.id,
      dto.endpoint,
      dto.keys.p256dh,
      dto.keys.auth,
      dto.userAgent,
      dto.label,
    );
  }

  // ── Commun ──────────────────────────────────────────────────

  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribePushDto) {
    return this.push.unsubscribe(dto.endpoint);
  }

  // Test rapide depuis le portail partenaire (bouton "Tester les notifications")
  @Post('test/partner')
  async testPartner(@Body() dto: TestPushDto) {
    if (!dto.token) throw new BadRequestException('token requis');
    const partnerId = await this.push.resolvePartnerIdFromToken(dto.token);
    if (!partnerId) throw new UnauthorizedException('Token invalide');

    return this.push.sendToPartner(partnerId, {
      title: dto.title || '🔔 Test Yitewo',
      body: dto.body || 'Les notifications fonctionnent sur cet appareil.',
    });
  }

  @Post('test/admin')
  @UseGuards(JwtAuthGuard)
  async testAdmin(@Body() dto: TestPushDto) {
    return this.push.sendToAdmins({
      title: dto.title || '🔔 Test Yitewo Admin',
      body: dto.body || 'Les notifications fonctionnent sur cet appareil.',
    });
  }
}
