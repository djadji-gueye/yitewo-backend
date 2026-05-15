import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const WA_API = 'https://graph.facebook.com/v19.0';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private conversations: Map<string, { messages: any[]; updatedAt: number }> = new Map();

  constructor(private prisma: PrismaService) {
    setInterval(() => this.cleanOldConversations(), 10 * 60 * 1000);
  }

  // ─────────────────────────────────────────────────────
  //  CONFIG : lecture / écriture en base (persistance)
  // ─────────────────────────────────────────────────────

  async getConfig() {
    // On utilise toujours la première (et unique) ligne de config
    const config = await (this.prisma as any).whatsappConfig.findFirst();
    if (!config) return null;
    return {
      phoneId: config.phoneId,
      // On ne renvoie pas le token complet pour la sécurité — on masque
      tokenMasked: config.token ? `${config.token.substring(0, 8)}${'*'.repeat(12)}` : '',
      verifyToken: config.verifyToken,
      // On ne renvoie pas la groqApiKey en clair non plus
      groqKeyMasked: config.groqApiKey ? `${config.groqApiKey.substring(0, 8)}${'*'.repeat(12)}` : '',
      isConnected: config.isConnected,
      updatedAt: config.updatedAt,
    };
  }

  async upsertConfig(dto: {
    phoneId: string;
    token: string;
    verifyToken: string;
    groqApiKey: string;
  }) {
    const existing = await (this.prisma as any).whatsappConfig.findFirst();

    const data = {
      phoneId: dto.phoneId,
      token: dto.token,
      verifyToken: dto.verifyToken || 'yitewo_webhook_2024',
      groqApiKey: dto.groqApiKey,
      isConnected: !!(dto.token && dto.phoneId && dto.groqApiKey),
    };

    if (existing) {
      return (this.prisma as any).whatsappConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      return (this.prisma as any).whatsappConfig.create({ data });
    }
  }

  // ─────────────────────────────────────────────────────
  //  Lecture des credentials (DB en priorité, .env en fallback)
  // ─────────────────────────────────────────────────────

  private async getCredentials(): Promise<{
    token: string;
    phoneId: string;
    verifyToken: string;
    groqApiKey: string;
  }> {
    const config = await (this.prisma as any).whatsappConfig.findFirst();
    return {
      token: config?.token || process.env.WHATSAPP_TOKEN || '',
      phoneId: config?.phoneId || process.env.WHATSAPP_PHONE_ID || '',
      verifyToken: config?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'yitewo_webhook_2024',
      groqApiKey: config?.groqApiKey || process.env.GROQ_API_KEY || '',
    };
  }

  // ─────────────────────────────────────────────────────
  //  WEBHOOK
  // ─────────────────────────────────────────────────────

  async verifyWebhook(mode: string, token: string): Promise<boolean> {
    const creds = await this.getCredentials();
    return mode === 'subscribe' && token === creds.verifyToken;
  }

  async handleWebhook(body: any) {
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages) return;

    for (const message of value.messages) {
      const from = message.from;
      let text = '';
      if (message.type === 'text') text = message.text?.body || '';
      else if (message.type === 'interactive') {
        text = message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title || '';
      }
      if (!text.trim()) continue;

      this.logger.log(`📱 WhatsApp from ${from}: ${text}`);
      await this.markRead(message.id);
      const reply = await this.processMessage(from, text);
      if (reply) await this.sendMessage(from, reply);
    }
  }

  // ─────────────────────────────────────────────────────
  //  AGENT IA
  // ─────────────────────────────────────────────────────

  async processMessage(phone: string, userMessage: string): Promise<string> {
    const conv = this.getConversation(phone);
    const context = await this.buildContext();
    const creds = await this.getCredentials();

    if (!creds.groqApiKey) {
      return 'Agent IA non configuré. Veuillez configurer la clé Groq dans les paramètres.';
    }

    conv.messages.push({ role: 'user', content: userMessage });

    try {
      const response = await fetch(GROQ_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 400,
          temperature: 0.7,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(context) },
            ...conv.messages,
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        this.logger.error('Groq API error:', JSON.stringify(err));
        return 'Désolé, je rencontre un problème. Réessayez dans quelques instants.';
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content ||
        'Je n\'ai pas compris. Tapez *aide* pour voir les options.';

      conv.messages.push({ role: 'assistant', content: reply });
      this.saveConversation(phone, conv.messages);
      await this.handleIntent(phone, userMessage);

      return reply;
    } catch (err) {
      this.logger.error('Groq fetch error:', err);
      return 'Service temporairement indisponible. Réessayez plus tard.';
    }
  }

  private buildSystemPrompt(ctx: any): string {
    return `Tu es l'agent virtuel de Yitewo, la plateforme sénégalaise qui connecte clients, boutiques, restaurants et prestataires de services.

Tu réponds en français ou en wolof selon la langue du client. Tu es chaleureux, direct et TRÈS concis (max 3 phrases par réponse, jamais plus de 120 mots).

PARTENAIRES ACTIFS :
${ctx.partnersText}

PRESTATAIRES DE SERVICES :
${ctx.prestataireText}

RÈGLES :
- Cherche un service → donne nom + contact WhatsApp du prestataire
- Cherche boutique/resto → donne nom + lien yitewo.com/boutique/[slug]
- Veut s'inscrire → yitewo.com/partners
- Ne gères PAS les paiements
- N'invente JAMAIS d'infos absentes du contexte
- Si "aide" ou "menu" → liste les 4 services disponibles (Boutiques, Restaurants, Services à domicile, Opportunités)

Réponds toujours de façon naturelle et chaleureuse, comme un conseiller sénégalais.`;
  }

  private async buildContext() {
    const [partners, prestataires] = await Promise.all([
      this.prisma.partner.findMany({
        where: { isActive: true, type: { in: ['Marchand', 'Restaurant'] } },
        select: { name: true, type: true, city: true, slug: true, contact: true },
        take: 15,
      }),
      this.prisma.partner.findMany({
        where: { isActive: true, type: 'Prestataire' },
        select: { name: true, city: true, contact: true, serviceCategories: true },
        take: 20,
      }),
    ]);

    const partnersText = partners.length
      ? partners.map(p => `- ${p.name} (${p.type}) ${p.city} → yitewo.com/boutique/${p.slug}`).join('\n')
      : 'Aucun partenaire pour le moment.';

    const prestataireText = prestataires.length
      ? prestataires.map(p => {
        const cats = p.serviceCategories?.slice(0, 2).join(', ') || 'Services';
        return `- ${p.name} | ${cats} | ${p.city} → wa.me/${p.contact?.replace(/\s/g, '')}`;
      }).join('\n')
      : 'Aucun prestataire pour le moment.';

    return { partnersText, prestataireText };
  }

  private async handleIntent(phone: string, userMessage: string) {
    const msg = userMessage.toLowerCase();
    const serviceKeywords = [
      'plombier', 'électricien', 'ménage', 'coiffeur', 'jardinage',
      'climatisation', 'bricoleur', 'déménagement', 'plomberie', 'électricité',
    ];
    const found = serviceKeywords.find(k => msg.includes(k));
    if (!found) return;

    try {
      await (this.prisma as any).serviceRequest.create({
        data: {
          service: found.charAt(0).toUpperCase() + found.slice(1),
          city: 'Via WhatsApp',
          quarter: 'À préciser',
          customerPhone: phone,
          description: userMessage,
          status: 'PENDING',
        },
      });
      this.logger.log(`📋 ServiceRequest créée pour ${phone}: ${found}`);
    } catch (e: any) {
      this.logger.warn('ServiceRequest error:', e?.message);
    }
  }

  // ─────────────────────────────────────────────────────
  //  ENVOI WhatsApp
  // ─────────────────────────────────────────────────────

  async sendMessage(to: string, text: string) {
    const creds = await this.getCredentials();
    if (!creds.token || !creds.phoneId) {
      this.logger.warn('⚠️ WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID manquant (DB et .env)');
      return;
    }
    try {
      const res = await fetch(`${WA_API}/${creds.phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text, preview_url: false },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.logger.error('WhatsApp send error:', JSON.stringify(err));
      }
    } catch (err) {
      this.logger.error('WhatsApp fetch error:', err);
    }
  }

  private async markRead(messageId: string) {
    const creds = await this.getCredentials();
    if (!creds.token || !creds.phoneId) return;
    try {
      await fetch(`${WA_API}/${creds.phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      });
    } catch { }
  }

  // ─────────────────────────────────────────────────────
  //  GESTION DES CONVERSATIONS EN MÉMOIRE
  // ─────────────────────────────────────────────────────

  private getConversation(phone: string) {
    const existing = this.conversations.get(phone);
    if (existing && Date.now() - existing.updatedAt < 30 * 60 * 1000) return existing;
    return { messages: [], updatedAt: Date.now() };
  }

  private saveConversation(phone: string, messages: any[]) {
    this.conversations.set(phone, {
      messages: messages.slice(-8), // max 8 messages pour économiser tokens
      updatedAt: Date.now(),
    });
  }

  private cleanOldConversations() {
    const now = Date.now();
    for (const [phone, conv] of this.conversations.entries()) {
      if (now - conv.updatedAt > 30 * 60 * 1000) this.conversations.delete(phone);
    }
  }
}