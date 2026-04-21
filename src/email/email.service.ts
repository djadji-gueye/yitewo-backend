// ═══════════════════════════════════════════════════════
// src/email/email.service.ts
// Service email via Nodemailer + Gmail (gratuit)
// ═══════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,   // yitewoo@gmail.com
        pass: process.env.GMAIL_PASS,   // App Password Gmail (16 caractères)
      },
    });
  }

  // ── Méthode base ──────────────────────────────────────
  private async send(to: string, subject: string, html: string) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      this.logger.warn('Email non configuré — GMAIL_USER ou GMAIL_PASS manquant');
      return;
    }
    if (!to || !to.includes('@')) {
      this.logger.warn(`Email invalide ignoré : ${to}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: `"Yitewo 🇸🇳" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email envoyé → ${to} | ${subject}`);
    } catch (err) {
      this.logger.error(`Échec email → ${to} : ${err.message}`);
    }
  }

  // ── Styles partagés ───────────────────────────────────
  private layout(content: string, footer = '') {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f3f1; color: #1a1a1a; }
    .wrapper { max-width: 560px; margin: 24px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a0500, #E8380D); padding: 28px 32px; text-align: center; }
    .header .logo { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
    .header .logo span { opacity: 0.75; }
    .header .subtitle { color: rgba(255,255,255,0.75); font-size: 13px; margin-top: 4px; }
    .body { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
    .text { font-size: 14px; line-height: 1.7; color: #555; margin-bottom: 14px; }
    .highlight { background: #fff5f3; border-left: 4px solid #E8380D; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 18px 0; }
    .highlight .label { font-size: 11px; font-weight: 700; color: #E8380D; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    .highlight .value { font-size: 15px; font-weight: 600; color: #1a1a1a; }
    .btn { display: inline-block; padding: 14px 28px; background: #E8380D; color: #fff !important; text-decoration: none; border-radius: 99px; font-weight: 700; font-size: 14px; margin: 18px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0ebe8; font-size: 13px; }
    .info-row .k { color: #aaa; }
    .info-row .v { font-weight: 600; text-align: right; max-width: 60%; }
    .footer-div { padding: 20px 32px; background: #fafaf8; border-top: 1px solid #f0ebe8; font-size: 12px; color: #aaa; text-align: center; line-height: 1.6; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 700; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-orange { background: #fef3c7; color: #92400e; }
    @media (max-width: 600px) { .wrapper { margin: 0; border-radius: 0; } .body { padding: 24px 20px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">yite<span>wo</span></div>
      <div class="subtitle">La marketplace de votre quartier 🇸🇳</div>
    </div>
    <div class="body">${content}</div>
    <div class="footer-div">
      ${footer || 'Yitewo · Partout au Sénégal · <a href="https://yitewo.com" style="color:#E8380D">yitewo.com</a><br>Pour toute question : yitewoo@gmail.com'}
    </div>
  </div>
</body>
</html>`;
  }

  // ══════════════════════════════════════════════════════
  // 1. INSCRIPTION REÇUE — en attente de validation
  // ══════════════════════════════════════════════════════
  async sendInscriptionRecu(to: string, partnerName: string, type: string) {
    const typeLabel = type === 'Restaurant' ? 'restaurant' : type === 'Prestataire' ? 'prestataire' : 'boutique';
    const html = this.layout(`
      <p class="greeting">Bonjour ${partnerName} 👋</p>
      <p class="text">Nous avons bien reçu votre demande d'inscription en tant que <strong>${typeLabel}</strong> sur Yitewo. Merci de nous faire confiance !</p>
      <div class="highlight">
        <div class="label">Statut de votre dossier</div>
        <div class="value">⏳ En cours d'examen</div>
      </div>
      <p class="text">Notre équipe va examiner votre dossier sous <strong>24 à 48 heures</strong>. Vous recevrez un email dès que votre compte sera activé.</p>
      <p class="text">En attendant, si vous avez des questions, n'hésitez pas à nous écrire ou nous contacter sur WhatsApp.</p>
      <a href="https://wa.me/221770698080?text=Bonjour Yitewo, j'ai soumis ma candidature et j'aimerais des informations" class="btn">Nous contacter</a>
      <p class="text" style="color:#aaa;font-size:12px">Référence : ${partnerName} · ${new Date().toLocaleDateString('fr-SN')}</p>
    `);
    await this.send(to, `✅ Candidature reçue — Yitewo`, html);
  }

  // ══════════════════════════════════════════════════════
  // 2. COMPTE ACTIVÉ + LIEN PORTAIL (Marchand/Restaurant)
  // ══════════════════════════════════════════════════════
  async sendCompteActive(to: string, partnerName: string, type: string, portalToken: string) {
    const portalUrl = `https://yitewo.com/partner-portal/${portalToken}`;
    const typeLabel = type === 'Restaurant' ? 'restaurant' : 'boutique';
    const html = this.layout(`
      <p class="greeting">🎉 Félicitations ${partnerName} !</p>
      <p class="text">Votre compte ${typeLabel} a été <strong>validé et activé</strong> sur Yitewo. Vous faites maintenant partie de notre réseau de partenaires !</p>
      <div class="highlight">
        <div class="label">Votre lien d'administration personnel</div>
        <div class="value" style="font-size:13px;word-break:break-all">${portalUrl}</div>
      </div>
      <p class="text">⚠️ Ce lien est <strong>confidentiel</strong>. Gardez-le précieusement — il vous donne accès à votre tableau de bord pour gérer vos produits, commandes et profil.</p>
      <a href="${portalUrl}" class="btn">Accéder à mon espace partenaire →</a>
      <p class="text" style="font-weight:600;margin-top:8px">Ce que vous pouvez faire dès maintenant :</p>
      <p class="text" style="margin-top:4px">
        ✅ Ajouter vos produits ou services<br>
        ✅ Uploader votre photo et bannière<br>
        ✅ Rédiger votre description<br>
        ✅ Recevoir et gérer vos commandes
      </p>
      <p class="text">Besoin d'aide ? Notre équipe est disponible sur WhatsApp.</p>
      <a href="https://wa.me/221777259330?text=Bonjour, je viens d'activer mon compte partenaire Yitewo et j'ai besoin d'aide" style="color:#E8380D;font-size:13px">📱 Contacter le support</a>
    `);
    await this.send(to, `🎉 Votre compte Yitewo est activé !`, html);
  }

  // ══════════════════════════════════════════════════════
  // 3. COMPTE ACTIVÉ PRESTATAIRE (sans portail)
  // ══════════════════════════════════════════════════════
  async sendCompteActivePrestataire(to: string, partnerName: string) {
    const html = this.layout(`
      <p class="greeting">🎉 Bienvenue dans le réseau Yitewo, ${partnerName} !</p>
      <p class="text">Votre profil de prestataire a été <strong>validé et activé</strong>. Vous êtes maintenant visible par des milliers d'habitants au Sénégal !</p>
      <div class="highlight">
        <div class="label">Votre profil est en ligne sur</div>
        <div class="value"><a href="https://yitewo.com/services" style="color:#E8380D">yitewo.com/services</a></div>
      </div>
      <p class="text">Lorsqu'un client vous envoie une demande, vous serez contacté directement sur votre numéro WhatsApp. Assurez-vous qu'il soit actif et disponible.</p>
      <a href="https://yitewo.com/services" class="btn">Voir mon profil en ligne →</a>
      <p class="text" style="color:#aaa;font-size:12px">Pour modifier votre profil ou signaler un problème, contactez-nous sur yitewoo@gmail.com</p>
    `);
    await this.send(to, `🎉 Votre profil prestataire Yitewo est activé !`, html);
  }

  // ══════════════════════════════════════════════════════
  // 4. NOUVELLE COMMANDE → email au partenaire
  // ══════════════════════════════════════════════════════
  async sendNouvelleCommande(to: string, partnerName: string, order: {
    id: string;
    customerName?: string;
    customerPhone?: string;
    quarter: string;
    city: string;
    totalPrice: number;
    items: { name: string; quantity: number; unitPrice: number }[];
    portalToken?: string;
  }) {
    const itemsHtml = order.items.map((item) =>
      `<div class="info-row"><span class="k">${item.quantity}x ${item.name}</span><span class="v">${(item.quantity * item.unitPrice).toLocaleString('fr-FR')} FCFA</span></div>`
    ).join('');

    const portalLink = order.portalToken
      ? `<a href="https://yitewo.com/partner-portal/${order.portalToken}/commandes" class="btn">Gérer la commande →</a>`
      : '';

    const html = this.layout(`
      <p class="greeting">🛒 Nouvelle commande !</p>
      <p class="text">Bonjour <strong>${partnerName}</strong>, vous avez reçu une nouvelle commande sur Yitewo.</p>
      <div class="highlight">
        <div class="label">Client</div>
        <div class="value">${order.customerName || 'Anonyme'}${order.customerPhone ? ` · ${order.customerPhone}` : ''}</div>
      </div>
      <div class="info-row"><span class="k">📍 Livraison</span><span class="v">${order.quarter}, ${order.city}</span></div>
      ${itemsHtml}
      <div class="info-row" style="margin-top:8px;padding-top:12px;border-top:2px solid #E8380D">
        <span class="k" style="font-weight:700;color:#1a1a1a">Total</span>
        <span class="v" style="color:#E8380D;font-size:16px">${order.totalPrice.toLocaleString('fr-FR')} FCFA</span>
      </div>
      ${portalLink}
      <p class="text" style="font-size:12px;color:#aaa;margin-top:12px">Référence commande : #${order.id.slice(-8).toUpperCase()}</p>
    `);
    await this.send(to, `🛒 Nouvelle commande Yitewo — ${order.totalPrice.toLocaleString('fr-FR')} FCFA`, html);
  }

  // ══════════════════════════════════════════════════════
  // 5. COMMUNICATION GROUPÉE ADMIN → par type
  // ══════════════════════════════════════════════════════
  async sendCommunicationGroupe(to: string, partnerName: string, subject: string, body: string) {
    const html = this.layout(`
      <p class="greeting">Bonjour ${partnerName} 👋</p>
      ${body.split('\n').filter(Boolean).map((p) => `<p class="text">${p}</p>`).join('')}
      <p class="text" style="margin-top:24px;color:#aaa;font-size:12px">
        Ce message a été envoyé à tous les partenaires Yitewo de votre catégorie.<br>
        Pour vous désinscrire de ces communications, écrivez-nous à yitewoo@gmail.com.
      </p>
    `);
    await this.send(to, `📢 ${subject} — Yitewo`, html);
  }
}