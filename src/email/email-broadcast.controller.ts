// src/email/email-broadcast.controller.ts
// Route admin pour envoyer des emails groupés par type de partenaire

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

class BroadcastDto {
    subject: string;
    body: string;
    targetType: 'all' | 'Marchand' | 'Restaurant' | 'Prestataire';
}

@Controller('admin/email-broadcast')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
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
}