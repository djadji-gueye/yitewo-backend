import { Controller, Get, Post, Body, Query, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  // ── Vérification webhook Meta (GET) ──────────────────────────────
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'yitewo_webhook_2024';
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ WhatsApp webhook vérifié');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // ── Réception des messages entrants (POST) ───────────────────────
  @Post('webhook')
  @HttpCode(200)
  async receive(@Body() body: any) {
    try {
      await this.service.handleWebhook(body);
    } catch (e) {
      console.error('WhatsApp webhook error:', e);
    }
    return { status: 'ok' };
  }

  // ── Test de l'agent depuis le dashboard ──────────────────────────
  @Post('test-agent')
  async testAgent(@Body() body: { message: string; phone?: string }) {
    const reply = await this.service.processMessage(
      body.phone || '221700000000',
      body.message,
    );
    // Retourner directement la string pour le dashboard
    return { reply };
  }
}
