import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerProductDto } from './dto/create-partner-product.dto';
import { UpdatePartnerProductDto } from './dto/update-partner-product.dto';

@Injectable()
export class PartnerProductsService {
  constructor(private prisma: PrismaService) { }

  // ── Vérifie le token et retourne le partnerId ─────────────
  private async verifyToken(token: string): Promise<string> {
    const pt = await this.prisma.partnerToken.findUnique({
      where: { token },
      select: { partnerId: true },
    });
    if (!pt) throw new UnauthorizedException('Token invalide');
    return pt.partnerId;
  }

  // ── Lister les produits d'un partenaire ───────────────────
  async findAll(token: string) {
    const partnerId = await this.verifyToken(token);
    return this.prisma.partnerProduct.findMany({
      where: { partnerId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  // ── Créer un produit ──────────────────────────────────────
  async create(dto: CreatePartnerProductDto) {
    const partnerId = await this.verifyToken(dto.token);

    // Limite selon le plan du partenaire
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { plan: true },
    });
    const LIMITS: Record<string, number> = {
      free: 5,
      pro: 999999,
      business: 999999,
      enterprise: 999999,
    };
    const maxProducts = LIMITS[partner?.plan || 'free'];
    const count = await this.prisma.partnerProduct.count({ where: { partnerId } });
    if (count >= maxProducts) {
      throw new Error(
        partner?.plan === 'free'
          ? `Limite de ${maxProducts} produits atteinte sur le plan Gratuit. Passez au plan Pro pour des produits illimités.`
          : 'Limite atteinte'
      );
    }

    return this.prisma.partnerProduct.create({
      data: {
        partnerId,
        name: dto.name,
        price: dto.price,
        category: dto.category ?? 'plat',
        description: dto.description,
        imageUrl: dto.imageUrl,
      },
    });
  }

  // ── Modifier un produit ───────────────────────────────────
  async update(id: string, dto: UpdatePartnerProductDto) {
    const partnerId = await this.verifyToken(dto.token);

    const product = await this.prisma.partnerProduct.findUnique({ where: { id } });
    if (!product || product.partnerId !== partnerId) {
      throw new NotFoundException('Produit introuvable');
    }

    return this.prisma.partnerProduct.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── Toggle actif/masqué ───────────────────────────────────
  async toggle(id: string, token: string, isActive: boolean) {
    const partnerId = await this.verifyToken(token);
    const product = await this.prisma.partnerProduct.findUnique({ where: { id } });
    if (!product || product.partnerId !== partnerId) {
      throw new NotFoundException('Produit introuvable');
    }
    return this.prisma.partnerProduct.update({ where: { id }, data: { isActive } });
  }

  // ── Supprimer un produit ──────────────────────────────────
  async remove(id: string, token: string) {
    const partnerId = await this.verifyToken(token);
    const product = await this.prisma.partnerProduct.findUnique({ where: { id } });
    if (!product || product.partnerId !== partnerId) {
      throw new NotFoundException('Produit introuvable');
    }
    await this.prisma.partnerProduct.delete({ where: { id } });
    return { ok: true };
  }

  // ── Produits publics (pour la page commande) ──────────────
  async findPublicBySlug(slug: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { slug },
      select: { id: true, name: true, city: true, contact: true },
    });
    if (!partner) throw new NotFoundException('Partenaire introuvable');

    const products = await this.prisma.partnerProduct.findMany({
      where: { partnerId: partner.id, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return { partner, products };
  }
}
