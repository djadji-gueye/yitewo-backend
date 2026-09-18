import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessListingSource, BusinessListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessListingDto } from './dto/create-business-listing.dto';
import { UpdateBusinessListingStatusDto } from './dto/update-business-listing-status.dto';

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  private normalizeText(value?: string) {
    return value ? value.trim().replace(/\s+/g, ' ') : '';
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'commerce';
  }

  private isVisibleStatus(status: BusinessListingStatus) {
    return status === BusinessListingStatus.VISIBLE || status === BusinessListingStatus.VERIFIED;
  }

  async create(data: CreateBusinessListingDto) {
    const name = this.normalizeText(data.name);
    const city = this.normalizeText(data.city);

    if (!name) throw new BadRequestException('Le nom du commerce est obligatoire.');
    if (!city) throw new BadRequestException('La ville est obligatoire.');

    const baseSlug = this.slugify(`${name}-${city}`);
    let slug = data.slug ? this.slugify(data.slug) : baseSlug;
    let index = 1;

    while (await this.prisma.businessListing.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${index}`;
      index += 1;
    }

    const status = data.status ?? BusinessListingStatus.PENDING;
    return this.prisma.businessListing.create({
      data: {
        ...data,
        name,
        city,
        slug,
        address: this.normalizeText(data.address) || null,
        zone: this.normalizeText(data.zone) || null,
        phone: this.normalizeText(data.phone) || null,
        email: this.normalizeText(data.email) || null,
        website: this.normalizeText(data.website) || null,
        description: this.normalizeText(data.description) || null,
        category: this.normalizeText(data.category) || null,
        source: data.source ?? BusinessListingSource.MANUAL,
        status,
        isVisible: this.isVisibleStatus(status),
      },
    });
  }

  async findAll(filters?: { city?: string; category?: string; status?: string }) {
    const where: Prisma.BusinessListingWhereInput = {};

    if (filters?.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters?.category) where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters?.status) {
      if (!Object.values(BusinessListingStatus).includes(filters.status as BusinessListingStatus)) {
        throw new BadRequestException('Statut de commerce invalide.');
      }
      where.status = filters.status as BusinessListingStatus;
    }

    return this.prisma.businessListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  findPending() {
    return this.prisma.businessListing.findMany({
      where: { status: BusinessListingStatus.PENDING },
      orderBy: { claimRequestedAt: 'asc' },
    });
  }

  findMap() {
    return this.prisma.businessListing.findMany({
      where: {
        isVisible: true,
        status: { in: [BusinessListingStatus.VISIBLE, BusinessListingStatus.VERIFIED] },
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async search(params?: { q?: string; city?: string; category?: string }) {
    const q = this.normalizeText(params?.q);
    const city = this.normalizeText(params?.city);
    const category = this.normalizeText(params?.category);
    const where: Prisma.BusinessListingWhereInput = {
      isVisible: true,
      status: { in: [BusinessListingStatus.VISIBLE, BusinessListingStatus.VERIFIED] },
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (category) where.category = { contains: category, mode: 'insensitive' };

    return this.prisma.businessListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findById(id: string) {
    const listing = await this.prisma.businessListing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Commerce introuvable.');
    return listing;
  }

  async findBySlug(slug: string) {
    const listing = await this.prisma.businessListing.findUnique({ where: { slug } });
    if (!listing) throw new NotFoundException('Commerce introuvable.');
    if (listing.status === BusinessListingStatus.REJECTED || !listing.isVisible) {
      throw new NotFoundException('Commerce introuvable.');
    }
    return listing;
  }

  async claim(id: string) {
    const listing = await this.findById(id);

    if (listing.status === BusinessListingStatus.REJECTED) {
      throw new BadRequestException('Cette fiche ne peut plus être revendiquée.');
    }
    if (listing.status === BusinessListingStatus.VERIFIED) {
      throw new ConflictException('Cette fiche est déjà vérifiée.');
    }
    if (listing.isClaimed || listing.claimRequestedAt) {
      throw new ConflictException('Une demande de validation existe déjà pour cette fiche.');
    }

    // La fiche reste visible pendant la validation, conformément au référencement public.
    return this.prisma.businessListing.update({
      where: { id },
      data: {
        isClaimed: true,
        claimRequestedAt: new Date(),
        status: BusinessListingStatus.PENDING,
        isVisible: true,
      },
    });
  }

  async verify(id: string, dto: UpdateBusinessListingStatusDto) {
    await this.findById(id);
    return this.prisma.businessListing.update({
      where: { id },
      data: {
        status: BusinessListingStatus.VERIFIED,
        isVisible: true,
        verifiedAt: new Date(),
        rejectedReason: dto.reason ?? null,
      },
    });
  }

  async reject(id: string, dto: UpdateBusinessListingStatusDto) {
    await this.findById(id);
    return this.prisma.businessListing.update({
      where: { id },
      data: {
        status: BusinessListingStatus.REJECTED,
        isVisible: false,
        rejectedReason: dto.reason ?? 'Non validé',
      },
    });
  }
}
