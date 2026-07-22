// src/email/email-broadcast.controller.ts
// Route admin pour envoyer des emails groupés par type de partenaire

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class BroadcastDto {
    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsString()
    @IsNotEmpty()
    body: string;

    @IsIn(['all', 'Marchand', 'Restaurant', 'Prestataire'])
    targetType: 'all' | 'Marchand' | 'Restaurant' | 'Prestataire';
}

export class BroadcastListDto {
    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsString()
    @IsNotEmpty()
    body: string;

    // Liste brute collée par l'admin : séparée par virgules, points-virgules ou retours à la ligne
    @IsString()
    @IsNotEmpty()
    emailsRaw: string;
}

// Extrait, nettoie, valide et dédoublonne une liste d'emails collée en texte libre
function parseEmailList(raw: string): { valid: string[]; invalidCount: number } {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const tokens = raw
        .split(/[\n,;]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

    const seen = new Set<string>();
    const valid: string[] = [];
    let invalidCount = 0;

    for (const t of tokens) {
        if (!EMAIL_RE.test(t)) {
            invalidCount++;
            continue;
        }
        if (seen.has(t)) continue;
        seen.add(t);
        valid.push(t);
    }
    return { valid, invalidCount };
}

@Controller('admin/email-broadcast')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class EmailBroadcastController {
    constructor(
        private prisma: PrismaService,
        private email: EmailService,
    ) { }

    @Post()
    async broadcast(@Body() dto: BroadcastDto) {
        const where: any = { isActive: true, email: { not: null } };
        if (dto.targetType !== 'all') where.type = dto.targetType;

        const partners = await this.prisma.partner.findMany({
            where,
            select: { id: true, name: true, email: true, type: true },
        });

        let sent = 0, failed = 0;

        for (const p of partners) {
            if (!p.email) continue;
            try {
                await this.email.sendCommunicationGroupe(p.email, p.name, dto.subject, dto.body);
                sent++;
            } catch {
                failed++;
            }
            // Délai 200ms entre chaque pour éviter le rate limit Gmail
            await new Promise((r) => setTimeout(r, 200));
        }

        return {
            total: partners.length,
            sent,
            failed,
            message: `${sent} email(s) envoyé(s) sur ${partners.length} partenaires`,
        };
    }

    // POST /admin/email-broadcast/list
    // Envoie une invitation à une liste d'emails externes saisie manuellement par l'admin
    // (ex: boutiques trouvées sur un annuaire, à inviter à rejoindre Yitewo)
    @Post('list')
    async broadcastToList(@Body() dto: BroadcastListDto) {
        const { valid, invalidCount } = parseEmailList(dto.emailsRaw);

        if (valid.length === 0) {
            return {
                total: 0,
                sent: 0,
                failed: 0,
                invalid: invalidCount,
                message: 'Aucune adresse email valide détectée dans la liste fournie.',
            };
        }

        // Garde-fou anti-spam : on plafonne le volume par envoi
        const MAX_PER_BATCH = 500;
        const batch = valid.slice(0, MAX_PER_BATCH);

        let sent = 0, failed = 0;

        for (const email of batch) {
            try {
                await this.email.sendInvitationProspect(email, dto.subject, dto.body);
                sent++;
            } catch {
                failed++;
            }
            // Délai 200ms entre chaque pour éviter le rate limit Gmail
            await new Promise((r) => setTimeout(r, 200));
        }

        return {
            total: batch.length,
            sent,
            failed,
            invalid: invalidCount,
            skipped: valid.length - batch.length,
            message: `${sent} invitation(s) envoyée(s) sur ${batch.length} adresse(s) valide(s)` +
                (invalidCount ? ` · ${invalidCount} adresse(s) ignorée(s) (invalides)` : '') +
                (valid.length > MAX_PER_BATCH ? ` · ${valid.length - MAX_PER_BATCH} en attente (limite ${MAX_PER_BATCH}/envoi)` : ''),
        };
    }
}