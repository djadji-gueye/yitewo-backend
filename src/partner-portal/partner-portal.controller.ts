import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { PartnerPortalService } from './partner-portal.service';
import { CreatePartnerProductDto } from './dto/create-partner-product.dto';
import { UpdatePartnerProductDto } from './dto/update-partner-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class PartnerPortalController {
  constructor(private service: PartnerPortalService) {}

  // ══ PUBLIC — Partner Portal (auth par token) ══════════════

  // Profil du partenaire via son token
  @Get('partners/portal/:token')
  getPartnerByToken(@Param('token') token: string) {
    return this.service.getPartnerByToken(token);
  }

  // Produits publics pour /order?partner=slug
  @Get('partners/:slug/products')
  getPublicProducts(@Param('slug') slug: string) {
    return this.service.getPublicProducts(slug);
  }

  // Produits du partenaire (portail)
  @Get('partner-products')
  getProducts(@Query('token') token: string) {
    return this.service.getProducts(token);
  }

  // Stats du partenaire
  @Get('partner-portal/stats')
  getStats(@Query('token') token: string) {
    return this.service.getStats(token);
  }

  // Créer un produit
  @Post('partner-products')
  createProduct(@Body() dto: CreatePartnerProductDto) {
    return this.service.createProduct(dto);
  }

  // Modifier un produit
  @Patch('partner-products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdatePartnerProductDto) {
    return this.service.updateProduct(id, dto);
  }

  // Toggle actif/masqué
  @Patch('partner-products/:id/toggle')
  toggleProduct(
    @Param('id') id: string,
    @Body('token') token: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.service.toggleProduct(id, token, isActive);
  }

  // Supprimer un produit
  @Delete('partner-products/:id')
  deleteProduct(@Param('id') id: string, @Query('token') token: string) {
    return this.service.deleteProduct(id, token);
  }

  // ══ ADMIN — Gestion des tokens ════════════════════════════

  // Générer/obtenir le token d'un partenaire
  @Post('partners/:id/token')
  @UseGuards(JwtAuthGuard)
  getOrCreateToken(@Param('id') id: string) {
    return this.service.getOrCreateToken(id);
  }

  // Révoquer le token d'un partenaire
  @Delete('partners/:id/token')
  @UseGuards(JwtAuthGuard)
  revokeToken(@Param('id') id: string) {
    return this.service.revokeToken(id);
  }
}
