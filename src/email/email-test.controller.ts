// src/email/email-test.controller.ts
// 🧪 Endpoint de TEST pour vérifier que les emails partent correctement
// À utiliser uniquement en développement/staging

import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EmailService } from './email.service';

import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class SendTestEmailDto {
    @IsEmail()
    to: string;

    @IsIn(['inscription', 'activation', 'prestataire', 'commande', 'communication'])
    type: 'inscription' | 'activation' | 'prestataire' | 'commande' | 'communication';

    @IsOptional()
    @IsString()
    partnerName?: string;
}

@Controller('test/email')
export class EmailTestController {
    private readonly logger = new Logger(EmailTestController.name);

    constructor(private email: EmailService) { }

    /**
     * 🧪 Test simple — Email de test
     * Usage: POST /test/email/simple
     * Body: { "to": "ton@email.com" }
     */
    @Post('simple')
    async sendSimple(@Body() dto: { to: string }) {
        this.logger.log(`📨 Test simple vers ${dto.to}`);

        if (!dto.to || !dto.to.includes('@')) {
            return {
                success: false,
                error: 'Email invalide',
                message: `L'adresse "${dto.to}" n'est pas valide`,
            };
        }

        // Vérifier les env
        const hasUser = !!process.env.GMAIL_USER;
        const hasPass = !!process.env.GMAIL_PASS;

        if (!hasUser || !hasPass) {
            this.logger.error('❌ Variables d\'env manquantes');
            return {
                success: false,
                error: 'Configuration manquante',
                details: {
                    GMAIL_USER: hasUser ? '✅ défini' : '❌ manquant',
                    GMAIL_PASS: hasPass ? '✅ défini' : '❌ manquant',
                },
                message: 'Ajoute GMAIL_USER et GMAIL_PASS dans ton .env',
            };
        }

        try {
            // Appeler directement le service
            await this.email.sendInscriptionRecu(dto.to, 'Test User', 'Restaurant');

            this.logger.log(`✅ Email envoyé avec succès à ${dto.to}`);
            return {
                success: true,
                message: `✅ Email envoyé à ${dto.to}`,
                details: {
                    from: process.env.GMAIL_USER,
                    to: dto.to,
                    subject: '✅ Candidature reçue — Yitewo',
                    type: 'inscription_recu',
                },
            };
        } catch (error) {
            this.logger.error(`❌ Erreur lors de l'envoi: ${error.message}`);
            return {
                success: false,
                error: error.message,
                message: '❌ Impossible d\'envoyer l\'email',
                details: {
                    from: process.env.GMAIL_USER,
                    to: dto.to,
                    errorType: error.code || 'UNKNOWN',
                },
            };
        }
    }

    /**
     * 🧪 Tous les types d'emails
     * Usage: POST /test/email/send
     * Body: {
     *   "to": "test@gmail.com",
     *   "type": "inscription" | "activation" | "prestataire" | "commande" | "communication",
     *   "partnerName": "Mon Commerce"
     * }
     */
    @Post('send')
    async sendTest(@Body() dto: SendTestEmailDto) {
        this.logger.log(
            `📨 Test email [${dto.type}] vers ${dto.to} pour ${dto.partnerName}`,
        );

        if (!dto.to || !dto.to.includes('@')) {
            return {
                success: false,
                error: 'Email invalide',
                message: `L'adresse "${dto.to}" n'est pas valide`,
            };
        }

        const name = dto.partnerName || 'Test User';

        try {
            switch (dto.type) {
                // ── 1. Inscription reçue ──
                case 'inscription':
                    await this.email.sendInscriptionRecu(dto.to, name, 'Restaurant');
                    this.logger.log(`✅ Email "inscription" envoyé à ${dto.to}`);
                    return {
                        success: true,
                        type: 'inscription_recu',
                        message: `✅ Email "Candidature reçue" envoyé à ${dto.to}`,
                        to: dto.to,
                    };

                // ── 2. Compte activé (Marchand/Restaurant)
                case 'activation':
                    const portalToken = 'test-token-' + Date.now();
                    await this.email.sendCompteActive(
                        dto.to,
                        name,
                        'Restaurant',
                        portalToken,
                    );
                    this.logger.log(`✅ Email "activation" envoyé à ${dto.to}`);
                    return {
                        success: true,
                        type: 'compte_active',
                        message: `✅ Email "Compte activé" envoyé à ${dto.to}`,
                        to: dto.to,
                        portalLink: `https://yitewo.com/partner-portal/${portalToken}`,
                    };

                // ── 3. Compte prestataire activé
                case 'prestataire':
                    await this.email.sendCompteActivePrestataire(dto.to, name);
                    this.logger.log(`✅ Email "prestataire" envoyé à ${dto.to}`);
                    return {
                        success: true,
                        type: 'prestataire_active',
                        message: `✅ Email "Profil prestataire activé" envoyé à ${dto.to}`,
                        to: dto.to,
                    };

                // ── 4. Nouvelle commande
                case 'commande':
                    const mockOrder = {
                        id: 'cmd-' + Date.now(),
                        customerName: 'Client Test',
                        customerPhone: '+221 77 123 45 67',
                        quarter: 'Plateau',
                        city: 'Dakar',
                        totalPrice: 45000,
                        items: [
                            { name: 'Thiéboudienne', quantity: 2, unitPrice: 15000 },
                            { name: 'Jus Gingembre', quantity: 1, unitPrice: 3000 },
                        ],
                        portalToken: 'token-' + Date.now(),
                    };
                    await this.email.sendNouvelleCommande(dto.to, name, mockOrder);
                    this.logger.log(`✅ Email "commande" envoyé à ${dto.to}`);
                    return {
                        success: true,
                        type: 'nouvelle_commande',
                        message: `✅ Email "Nouvelle commande" envoyé à ${dto.to}`,
                        to: dto.to,
                        orderPreview: {
                            id: mockOrder.id,
                            total: '45000 FCFA',
                            items: 2,
                        },
                    };

                // ── 5. Communication groupée
                case 'communication':
                    const subject = '[Test] Nouvelle mise à jour Yitewo';
                    const body = `Bonjour,\n\nCeci est un email de test pour vérifier que les communications groupées fonctionnent correctement.\n\nCordialement,\nL'équipe Yitewo`;
                    await this.email.sendCommunicationGroupe(
                        dto.to,
                        name,
                        subject,
                        body,
                    );
                    this.logger.log(`✅ Email "communication" envoyé à ${dto.to}`);
                    return {
                        success: true,
                        type: 'communication_groupe',
                        message: `✅ Email "Communication" envoyé à ${dto.to}`,
                        to: dto.to,
                    };

                default:
                    return {
                        success: false,
                        error: 'Type d\'email inconnu',
                        message: `Le type "${dto.type}" n'existe pas`,
                        availableTypes: [
                            'inscription',
                            'activation',
                            'prestataire',
                            'commande',
                            'communication',
                        ],
                    };
            }
        } catch (error) {
            this.logger.error(
                `❌ Erreur [${dto.type}] vers ${dto.to}: ${error.message}`,
                error.stack,
            );
            return {
                success: false,
                error: error.message,
                type: dto.type,
                to: dto.to,
                message: `❌ Impossible d'envoyer l'email [${dto.type}]`,
                errorDetails: {
                    code: error.code,
                    statusCode: error.statusCode,
                    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
                },
            };
        }
    }

    /**
     * 🔍 Vérifier la configuration Gmail
     * Usage: GET /test/email/config
     * Retourne l'état de la config (sans afficher les secrets)
     */
    @Post('config')
    async checkConfig() {
        this.logger.log('🔍 Vérification configuration email');

        const hasUser = !!process.env.GMAIL_USER;
        const hasPass = !!process.env.GMAIL_PASS;
        const user = process.env.GMAIL_USER || '';
        const passLength = process.env.GMAIL_PASS?.length || 0;

        return {
            configuration: {
                GMAIL_USER: {
                    defined: hasUser,
                    value: hasUser ? user.replace(/(.{2})(.*)(.{2})/, '$1***$3') : '❌ manquant',
                    email: hasUser ? user : null,
                },
                GMAIL_PASS: {
                    defined: hasPass,
                    length: passLength,
                    hint: hasPass
                        ? passLength === 16
                            ? '✅ Semble être un App Password (16 chars)'
                            : `⚠️ Longueur: ${passLength} chars (normalement 16 pour App Password)`
                        : '❌ manquant',
                },
                nodemailer: {
                    installed: true,
                    version: '8.0.5',
                },
            },
            status: hasUser && hasPass ? '✅ Prêt à envoyer' : '❌ Configuration incomplète',
            nextSteps: !hasUser
                ? 'Ajoute GMAIL_USER dans .env (format: email@gmail.com)'
                : !hasPass
                    ? 'Ajoute GMAIL_PASS dans .env (App Password Gmail, 16 caractères)'
                    : passLength !== 16
                        ? 'Vérifie que GMAIL_PASS est un App Password (16 caractères) et non le mot de passe normal'
                        : '✅ Configuration valide! Procède aux tests.',
        };
    }

    /**
     * 📋 Liste toutes les méthodes disponibles
     * Usage: GET /test/email
     */
    @Post('/')
    async getHelp() {
        return {
            message: '🧪 Endpoints de test email',
            endpoints: [
                {
                    method: 'POST',
                    path: '/test/email/config',
                    description: 'Vérifier la configuration Gmail',
                    example: 'curl -X POST http://localhost:3000/test/email/config',
                },
                {
                    method: 'POST',
                    path: '/test/email/simple',
                    description: 'Envoyer un simple email de test',
                    body: { to: 'test@gmail.com' },
                    example:
                        'curl -X POST http://localhost:3000/test/email/simple -H "Content-Type: application/json" -d \'{"to":"test@gmail.com"}\'',
                },
                {
                    method: 'POST',
                    path: '/test/email/send',
                    description: 'Envoyer un email de type spécifique',
                    body: {
                        to: 'test@gmail.com',
                        type: 'inscription|activation|prestataire|commande|communication',
                        partnerName: 'Mon Commerce (optionnel)',
                    },
                    examples: [
                        'curl -X POST http://localhost:3000/test/email/send -H "Content-Type: application/json" -d \'{"to":"test@gmail.com","type":"inscription","partnerName":"Mon Restaurant"}\'',
                        'curl -X POST http://localhost:3000/test/email/send -H "Content-Type: application/json" -d \'{"to":"test@gmail.com","type":"commande"}\'',
                    ],
                },
            ],
        };
    }
}
