import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessListingSource, BusinessListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessListingDto } from './dto/create-business-listing.dto';
import { ImportOsmBusinessDto } from './dto/import-osm-business.dto';
import { UpdateBusinessListingStatusDto } from './dto/update-business-listing-status.dto';

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  private normalizeText(value?: string) { return value ? value.trim().replace(/\s+/g, ' ') : ''; }
  private slugify(value: string) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'commerce';
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
    for (let index = 1; await this.prisma.businessListing.findUnique({ where: { slug } }); index += 1) slug = `${baseSlug}-${index}`;
    const status = data.status ?? BusinessListingStatus.PENDING;
    return this.prisma.businessListing.create({ data: {
      ...data, name, city, slug,
      category: this.normalizeText(data.category) || null,
      zone: this.normalizeText(data.zone) || null,
      address: this.normalizeText(data.address) || null,
      phone: this.normalizeText(data.phone) || null,
      email: this.normalizeText(data.email) || null,
      website: this.normalizeText(data.website) || null,
      description: this.normalizeText(data.description) || null,
      imageUrl: this.normalizeText(data.imageUrl) || null,
      source: data.source ?? BusinessListingSource.MANUAL,
      status, isVisible: this.isVisibleStatus(status),
    } });
  }

  async importFromOsm(dto: ImportOsmBusinessDto) {
    const city = this.normalizeText(dto.city);
    const limit = dto.limit ?? 100;
    const category = this.normalizeText(dto.category);
    const areaUrl = new URL('https://nominatim.openstreetmap.org/search');
    areaUrl.searchParams.set('q', `${city}, Sénégal`);
    areaUrl.searchParams.set('format', 'jsonv2');
    areaUrl.searchParams.set('limit', '1');
    areaUrl.searchParams.set('countrycodes', 'sn');

    const areaResponse = await fetch(areaUrl, { headers: { 'User-Agent': 'Yitewo/1.0 contact@yitewo.com', 'Accept-Language': 'fr' } });
    if (!areaResponse.ok) throw new BadRequestException('Le service de localisation est indisponible.');
    const areas: any[] = await areaResponse.json();
    const area = areas[0];
    if (!area?.lat || !area?.lon) throw new BadRequestException(`Ville introuvable : ${city}.`);

    const tagFilter = category
      ? `nwr["${category === 'restaurant' ? 'amenity' : 'shop'}"="${category}"](around:15000,${area.lat},${area.lon});`
      : `nwr["shop"](around:15000,${area.lat},${area.lon}); nwr["amenity"="restaurant"](around:15000,${area.lat},${area.lon}); nwr["amenity"="cafe"](around:15000,${area.lat},${area.lon});`;
    const query = `[out:json][timeout:60];(${tagFilter});out center tags ${Math.min(limit, 500)};`;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'Yitewo/1.0 contact@yitewo.com' },
      body: query,
    });
    if (!response.ok) throw new BadRequestException('Le service de recherche est temporairement indisponible.');
    const payload: any = await response.json();
    const elements = Array.isArray(payload.elements) ? payload.elements.slice(0, limit) : [];
    let imported = 0;
    let skipped = 0;

    for (const element of elements) {
      const tags = element.tags || {};
      const name = this.normalizeText(tags.name);
      const latitude = Number(element.lat ?? element.center?.lat);
      const longitude = Number(element.lon ?? element.center?.lon);
      if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) { skipped += 1; continue; }
      const externalSourceId = `osm:${element.type}:${element.id}`;
      if (await this.prisma.businessListing.findUnique({ where: { externalSourceId } })) { skipped += 1; continue; }
      try {
        await this.create({
          name, city, category: tags.shop || tags.amenity || category || 'commerce',
          address: tags['addr:full'] || [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || undefined,
          zone: tags['addr:suburb'] || tags['addr:quarter'] || undefined,
          phone: tags.phone || tags['contact:phone'], website: tags.website || tags['contact:website'],
          latitude, longitude, source: BusinessListingSource.OPENSTREETMAP,
          status: BusinessListingStatus.VISIBLE, externalSourceId,
        });
        imported += 1;
      } catch { skipped += 1; }
    }
    return { city, requested: limit, imported, skipped };
  }

  async findAll(filters?: { city?: string; category?: string; status?: string }) {
    const where: Prisma.BusinessListingWhereInput = {};
    if (filters?.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters?.category) where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters?.status) {
      if (!Object.values(BusinessListingStatus).includes(filters.status as BusinessListingStatus)) throw new BadRequestException('Statut de commerce invalide.');
      where.status = filters.status as BusinessListingStatus;
    }
    return this.prisma.businessListing.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  findPending() { return this.prisma.businessListing.findMany({ where: { status: BusinessListingStatus.PENDING }, orderBy: { claimRequestedAt: 'asc' } }); }
  findMap() { return this.prisma.businessListing.findMany({ where: { isVisible: true, status: { in: [BusinessListingStatus.VISIBLE, BusinessListingStatus.VERIFIED] }, latitude: { not: null }, longitude: { not: null } }, orderBy: { createdAt: 'desc' } }); }

  async search(params?: { q?: string; city?: string; category?: string }) {
    const q = this.normalizeText(params?.q); const city = this.normalizeText(params?.city); const category = this.normalizeText(params?.category);
    const where: Prisma.BusinessListingWhereInput = { isVisible: true, status: { in: [BusinessListingStatus.VISIBLE, BusinessListingStatus.VERIFIED] } };
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { address: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (category) where.category = { contains: category, mode: 'insensitive' };
    return this.prisma.businessListing.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async findById(id: string) { const item = await this.prisma.businessListing.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Commerce introuvable.'); return item; }
  async findBySlug(slug: string) { const item = await this.prisma.businessListing.findUnique({ where: { slug } }); if (!item || item.status === BusinessListingStatus.REJECTED || !item.isVisible) throw new NotFoundException('Commerce introuvable.'); return item; }

  async claim(id: string) {
    const item = await this.findById(id);
    if (item.status === BusinessListingStatus.REJECTED) throw new BadRequestException('Cette fiche ne peut plus être revendiquée.');
    if (item.status === BusinessListingStatus.VERIFIED) throw new ConflictException('Cette fiche est déjà vérifiée.');
    if (item.isClaimed || item.claimRequestedAt) throw new ConflictException('Une demande de validation existe déjà pour cette fiche.');
    return this.prisma.businessListing.update({ where: { id }, data: { isClaimed: true, claimRequestedAt: new Date(), status: BusinessListingStatus.PENDING, isVisible: true } });
  }

  async verify(id: string, dto: UpdateBusinessListingStatusDto) { await this.findById(id); return this.prisma.businessListing.update({ where: { id }, data: { status: BusinessListingStatus.VERIFIED, isVisible: true, verifiedAt: new Date(), rejectedReason: dto.reason ?? null } }); }
  async reject(id: string, dto: UpdateBusinessListingStatusDto) { await this.findById(id); return this.prisma.businessListing.update({ where: { id }, data: { status: BusinessListingStatus.REJECTED, isVisible: false, rejectedReason: dto.reason ?? 'Non validé' } }); }
}
