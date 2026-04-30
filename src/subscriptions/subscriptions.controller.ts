import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto, RecordPaymentDto, ReportPaymentDto, ConfirmPaymentDto } from './dto/create-subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  // ── PUBLIC — partenaire signale son paiement Wave/OM ─────────────
  @Post('report-payment')
  reportPayment(@Body() dto: ReportPaymentDto) {
    return this.service.reportPayment(dto);
  }

  // ── PUBLIC — récupérer le plan d'un partenaire (par son token portal) ──
  @Get('partner/:partnerId/plan')
  getPartnerPlan(@Param('partnerId') partnerId: string) {
    return this.service.getPartnerPlan(partnerId);
  }

  // ── ADMIN ─────────────────────────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.service.findAll();
  }

  @Get('pending-payments')
  @UseGuards(JwtAuthGuard)
  findPendingPayments() {
    return this.service.findPendingPayments();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats() {
    return this.service.getStats();
  }

  @Post('activate')
  @UseGuards(JwtAuthGuard)
  createSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.service.createSubscription(dto);
  }

  @Post('record-payment')
  @UseGuards(JwtAuthGuard)
  recordPayment(@Body() dto: RecordPaymentDto) {
    return this.service.recordPayment(dto);
  }

  @Patch('payments/:id/confirm')
  @UseGuards(JwtAuthGuard)
  confirmPayment(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
    @Request() req: any,
  ) {
    return this.service.confirmPayment(id, req.user?.email || 'admin', dto.notes);
  }

  @Patch('partners/:partnerId/revoke')
  @UseGuards(JwtAuthGuard)
  revokePlan(@Param('partnerId') partnerId: string, @Body() body: { reason?: string }) {
    return this.service.revokePlan(partnerId, body.reason);
  }

  @Post('check-expired')
  @UseGuards(JwtAuthGuard)
  checkExpired() {
    return this.service.checkExpiredPlans();
  }
}
