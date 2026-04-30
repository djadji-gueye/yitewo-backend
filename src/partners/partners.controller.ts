import {
  Controller, Post, Get, Patch, Body,
  NotFoundException, Param, UseGuards,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('partners')
export class PartnersController {
  constructor(private service: PartnersService) { }

  // ── Public ──────────────────────────────────────────────────
  @Post()
  create(@Body() dto: CreatePartnerDto) { return this.service.create(dto); }

  // Liste publique des marchands/restaurants actifs
  @Get('public/active')
  findPublicActive() { return this.service.findPublicActive(); }

  @Get('portal/:token')
  getByPortalToken(@Param('token') token: string) {
    return this.service.findByPortalToken(token);
  }

  @Get(':slug/products')
  async getPartnerProducts(@Param('slug') slug: string) {
    return this.service.getPublicProducts(slug);
  }

  @Get(':slug')
  async getPartner(@Param('slug') slug: string) {
    const partner = await this.service.findBySlug(slug);
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  // ── Admin (JWT protected) ─────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() { return this.service.findAll(); }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updatePartner(@Param('id') id: string, @Body() body: { isActive?: boolean; profileImageUrl?: string; plan?: string }) {
    return this.service.updatePartner(id, body);
  }

  // Génère un token portal pour un partenaire
  @Post(':id/portal-token')
  @UseGuards(JwtAuthGuard)
  generatePortalToken(@Param('id') id: string) {
    return this.service.generatePortalToken(id);
  }

  // Liste tous les tokens portal
  @Get('admin/portal-tokens')
  @UseGuards(JwtAuthGuard)
  listPortalTokens() { return this.service.listPortalTokens(); }
}
