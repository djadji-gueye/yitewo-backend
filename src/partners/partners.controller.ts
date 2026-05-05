import {
  Controller, Post, Get, Patch, Body,
  NotFoundException, Param, UseGuards,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { multerConfig } from '../common/multer.config';

@Controller('partners')
export class PartnersController {
  constructor(
    private service: PartnersService,
    private cloudinary: CloudinaryService,
  ) {}

  // ── Public ────────────────────────────────────────────────────

  @Post()
  create(@Body() dto: CreatePartnerDto) {
    return this.service.create(dto);
  }

  // Upload photo de profil (prestataires) ou logo (marchands)
  @Post('upload-profile-image')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadProfileImage(@UploadedFile() file: Express.Multer.File) {
    const result: any = await this.cloudinary.uploadImage(file, 'partners');
    return { url: result.secure_url };
  }

  // Boutiques & Restaurants triés par plan (page /order)
  @Get('public/shop')
  findPublicShop() {
    return this.service.findPublicShop();
  }

  // Prestataires triés par plan (page /services)
  @Get('public/active')
  findPublicActive() {
    return this.service.findPublicActive();
  }

  // Partenaires géolocalisés (carte)
  @Get('public/map')
  findForMap() {
    return this.service.findForMap();
  }

  // Portal token
  @Get('portal/:token')
  getByPortalToken(@Param('token') token: string) {
    return this.service.findByPortalToken(token);
  }

  // Produits publics d'un partenaire
  @Get(':slug/products')
  async getPartnerProducts(@Param('slug') slug: string) {
    return this.service.getPublicProducts(slug);
  }

  // Fiche publique par slug
  @Get(':slug')
  async getPartner(@Param('slug') slug: string) {
    const partner = await this.service.findBySlug(slug);
    if (!partner) throw new NotFoundException('Partenaire introuvable');
    return partner;
  }

  // ── Admin (JWT requis) ────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updatePartner(
    @Param('id') id: string,
    @Body() body: {
      isActive?: boolean;
      profileImageUrl?: string;
      bannerUrl?: string;
      plan?: string;
      planExpiresAt?: Date;
    },
  ) {
    return this.service.updatePartner(id, body);
  }

  @Post(':id/portal-token')
  @UseGuards(JwtAuthGuard)
  generatePortalToken(@Param('id') id: string) {
    return this.service.generatePortalToken(id);
  }

  @Get('admin/portal-tokens')
  @UseGuards(JwtAuthGuard)
  listPortalTokens() {
    return this.service.listPortalTokens();
  }
}
