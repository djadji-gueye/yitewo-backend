import {
  Controller, Get, Post, Body, Query,
  Res, HttpCode, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

export class UpsertConfigDto {
  phoneId: string;
  token: string;
  verifyToken: string;
  groqApiKey: string;
}

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly service: WhatsappService) { }

  // ── Vérification webhook Meta (GET) ──────────────────────────────
  @Get('webhook')
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const ok = await this.service.verifyWebhook(mode, token);
    if (ok) {
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
    return { reply };
  }

  // ── Lire la config WhatsApp (dashboard) ─────────────────────────
  @Get('config')
  @UseGuards(JwtAuthGuard)
  async getConfig() {
    const config = await this.service.getConfig();
    return config ?? { isConnected: false };
  }

  // ── Sauvegarder la config WhatsApp en base ───────────────────────
  @Post('config')
  @UseGuards(JwtAuthGuard)
  async saveConfig(@Body() dto: UpsertConfigDto) {
    if (!dto.phoneId || !dto.token || !dto.groqApiKey) {
      return { success: false, error: 'Champs manquants (phoneId, token, groqApiKey)' };
    }
    const saved = await this.service.upsertConfig(dto);
    return {
      success: true,
      isConnected: saved.isConnected,
      updatedAt: saved.updatedAt,
    };
  }
}