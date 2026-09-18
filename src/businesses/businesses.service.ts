import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessListingSource, BusinessListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessListingDto } from './dto/create-business-listing.dto';
import { ImportGoogleBusinessDto } from './dto/import-google-business.dto';
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

  private extractCityFromGoogleResult(payload: any, fallback?: string) {
    const components = payload?.address_components ?? [];
    const cityCandidate = components.find((item: any) =>
      Array.isArray(item?.types) && item.types.includes('locality'),
    );

    const subLocality = components.find((item: any) =>
      Array.isArray(item?.types) && item.types.includes('sublocality'),
    );

    return this.normalizeText(cityCandidate?.long_name || subLocality?.long_name || fallback || 'Dakar');
  }

  async create(data: CreateBusinessListingDto) {
    const name = this.normalizeText(data.name);
    const city = this.normalizeText(data.city);

    if (!name) {
      throw new BadRequestException('Le nom du commerce est obligatoire.');
    }
    if (!city) {
      throw new BadRequestException('La ville est obligatoire.');
    }

    if (data.googlePlaceId) {
      const existingByGooglePlaceId = await this.prisma.businessListing.findUnique({
        where: { googlePlaceId: data.googlePlaceId },
      });
      if (existingByGooglePlaceId) {
        return existingByGooglePlaceId;
      }
    }

    const baseSlug = this.slugify(`${name}-${city}`);
    let slug = data.slug ? this.slugify(data.slug) : baseSlug;

    let index = 1;
    while (await this.prisma.businessListing.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${index}`;
      index += 1;
    }

    const status = data.status ?? BusinessListingStatus.PENDING;
    const listing = await this.prisma.businessListing.create({
      data: {
        ...data,
        name,
        city,
        slug,
        googlePlaceId: data.googlePlaceId || null,
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

    return listing;
  }

  async importFromGoogle(dto: ImportGoogleBusinessDto) {
    const query = this.normalizeText(dto.query);
    if (!query) {
      throw new BadRequestException('La requête de recherche Google est obligatoire.');
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new BadRequestException(
        'La clé GOOGLE_PLACES_API_KEY n’est pas configurée. Ajoutez-la dans les variables d’environnement.',
      );
    }

    const sourceQuery = `${query} ${dto.city ?? ''}`.trim();
    const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findPlaceFromText/json');
    findUrl.searchParams.set('input', sourceQuery);
    findUrl.searchParams.set('inputtype', 'textquery');
    findUrl.searchParams.set('fields', 'place_id,formatted_address,name,geometry,types');
    findUrl.searchParams.set('key', apiKey);

    const findResponse = await fetch(findUrl.toString());
    const findData = await findResponse.json();

    if (!findResponse.ok || findData?.status === 'ZERO_RESULTS' || !findData?.candidates?.length) {
      throw new BadRequestException('Aucun commerce Google trouvé pour cette recherche.');
    }

    const candidate = findData.candidates[0];
    const placeId = candidate.place_id;

    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', placeId);
    detailsUrl.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,website,geometry,types,photos,address_components');
    detailsUrl.searchParams.set('key', apiKey);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();

    if (!detailsResponse.ok || !detailsData?.result) {
      throw new BadRequestException('Impossible de récupérer les détails du commerce Google.');
    }

    const result = detailsData.result;
    const city = this.extractCityFromGoogleResult(result, dto.city || 'Dakar');
    const name = this.normalizeText(result.name || query);
    const address = this.normalizeText(result.formatted_address || dto.city || '');

    const existing = await this.prisma.businessListing.findFirst({
      where: {
        OR: [
          { googlePlaceId: placeId },
          {
            name: { equals: name, mode: 'insensitive' },
            city: { equals: city, mode: 'insensitive' },
          },
        ],
      },
    });

    if (existing) {
      return existing;
    }

    return this.create({
      name,
      city,
      address,
      category: Array.isArray(result.types) ? result.types[0] : 'commerce',
      phone: this.normalizeText(result.formatted_phone_number) || undefined,
      website: this.normalizeText(result.website) || undefined,
      latitude: result.geometry?.location?.lat ?? undefined,
      longitude: result.geometry?.location?.lng ?? undefined,
      source: BusinessListingSource.GOOGLE,
      status: BusinessListingStatus.PENDING,
      googlePlaceId: placeId,
    });
  }

  async findAll(filters?: { city?: string; category?: string; status?: string }) {
    const where: Prisma.BusinessListingWhereInput = {};

    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters?.category) {
      where.category = { contains: filters.category, mode: 'insensitive' };
    }

    if (filters?.status) {
      where.status = filters.status as BusinessListingStatus;
    }

    return this.prisma.businessListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMap() {
    return this.prisma.businessListing.findMany({
      where: {
        isVisible: true,
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

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

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
    return listing;
  }

  async claim(id: string) {
    const listing = await this.prisma.businessListing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Commerce introuvable.');

    return this.prisma.businessListing.update({
      where: { id },
      data: {
        isClaimed: true,
        claimRequestedAt: new Date(),
        status: BusinessListingStatus.PENDING,
        isVisible: false,
      },
    });
  }

  async verify(id: string, dto: UpdateBusinessListingStatusDto) {
    const listing = await this.prisma.businessListing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Commerce introuvable.');

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
    const listing = await this.prisma.businessListing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Commerce introuvable.');

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
