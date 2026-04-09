import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { SubmitOpportunityDto } from './dto/submit-opportunity.dto';
import { CreateInterestDto } from './dto/create-interest.dto';
import { OpportunityCategory } from '@prisma/client';

export interface FindAllParams {
  page?: number;
  limit?: number;
  category?: string;
  city?: string;
  search?: string;
  isExternal?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

@Injectable()
export class OpportunitiesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) { }

  // ── Public: liste paginée ───────────────────
  async findAll(params: FindAllParams = {}) {
    const {
      page = 1,
      limit = 12,
      category,
      city,
      search,
      isExternal,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = { isPublished: true };

    if (category && category !== 'ALL') {
      where.category = category as OpportunityCategory;
    }
    if (city) {
      where.location = { contains: city, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isExternal !== undefined) {
      where.isExternal = isExternal;
    }
    // pour ne garder que les internes le temps d avoir l accord des sites externe expat-dakar ..
    else {
      where.isExternal = false; // défaut = interne
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.opportunity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { interests: true } } },
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  // ── Admin: toutes ───────────────────────────
  findAllAdmin(status?: string) {
    const where: any = {};
    if (status === 'published') where.isPublished = true;
    if (status === 'draft') where.isPublished = false;
    if (status === 'external') where.isExternal = true;
    return this.prisma.opportunity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { interests: true } } },
    });
  }

  async findBySlug(slug: string) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { slug },
      include: { _count: { select: { interests: true } } },
    });
    if (!opp) throw new NotFoundException('Opportunité introuvable');
    return opp;
  }

  create(dto: CreateOpportunityDto) {
    return this.prisma.opportunity.create({ data: { ...dto, contact: dto.contact ?? '' } });
  }

  async togglePublish(id: string, isPublished: boolean) {
    return this.prisma.opportunity.update({ where: { id }, data: { isPublished } });
  }

  async remove(id: string) {
    await this.prisma.opportunity.delete({ where: { id } });
    return { ok: true };
  }

  // ── Public: soumettre ───────────────────────
  async submit(dto: SubmitOpportunityDto) {
    const sub = await this.prisma.opportunitySubmission.create({ data: dto });
    await this.notifications.create(
      'NEW_OPPORTUNITY_SUBMISSION',
      `📋 Nouvelle annonce à valider : ${dto.title}`,
      `Catégorie : ${dto.category} · Contact : ${dto.contact}`,
      sub.id,
    );
    return sub;
  }

  // ── Public: intérêt ─────────────────────────
  async addInterest(opportunityId: string, dto: CreateInterestDto) {
    const opp = await this.prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opp) throw new NotFoundException('Opportunité introuvable');
    const interest = await this.prisma.opportunityInterest.create({
      data: { ...dto, opportunityId },
    });
    await this.notifications.create(
      'NEW_OPPORTUNITY_INTEREST',
      `💬 Intérêt pour : ${opp.title}`,
      `${dto.name} (${dto.phone})${dto.message ? ' — ' + dto.message.slice(0, 60) : ''}`,
      opp.id,
    );
    return interest;
  }

  // ── Admin: soumissions ──────────────────────
  findSubmissions() {
    return this.prisma.opportunitySubmission.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findSubmissionsByContact(contact: string) {
    if (!contact) return [];
    const cleaned = contact.replace(/\s+/g, '');
    return this.prisma.opportunitySubmission.findMany({
      where: {
        OR: [
          { contact: { contains: cleaned } },
          { contact: cleaned },
          { contact: contact },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, category: true,
        location: true, price: true, status: true,
        createdAt: true, updatedAt: true,
      },
    });
  }

  async approveSubmission(id: string) {
    const sub = await this.prisma.opportunitySubmission.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    const slug = sub.title
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 60);

    const opp = await this.prisma.opportunity.create({
      data: {
        title: sub.title,
        slug: `${slug}-${Date.now()}`,
        category: sub.category,
        location: sub.location,
        description: sub.description,
        price: sub.price ?? undefined,
        contact: sub.contact,
        isPublished: true,
      },
    });
    await this.notifications.create(
      'NEW_OPPORTUNITY_SUBMISSION',
      `✅ Annonce publiée : ${opp.title}`,
      `Slug : ${opp.slug}`, opp.id,
    );
    return opp;
  }

  rejectSubmission(id: string) {
    return this.prisma.opportunitySubmission.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  // ── Upsert externe (utilisé par le scraper) ─
  async upsertExternal(data: {
    title: string;
    slug: string;
    category: string;
    location: string;
    description: string;
    price?: string;
    imageUrl?: string;
    sourceUrl: string;
    sourceName: string;
  }) {
    const existing = await this.prisma.opportunity.findFirst({
      where: { sourceUrl: data.sourceUrl },
    });

    if (existing) {
      return this.prisma.opportunity.update({
        where: { id: existing.id },
        data: { price: data.price, updatedAt: new Date() },
      });
    }

    return this.prisma.opportunity.create({
      data: {
        title: data.title,
        slug: data.slug,
        category: data.category as any,
        location: data.location,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        contact: '',
        isPublished: true,
        isExternal: true,
        sourceUrl: data.sourceUrl,
        sourceName: data.sourceName,
      },
    });
  }

  // ── Purge annonces externes > 30 jours ───────
  async purgeOldExternal(daysOld = 30) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await this.prisma.opportunity.deleteMany({
      where: {
        isExternal: true,
        createdAt: { lt: cutoff },
      },
    });
    return result.count;
  }
}
