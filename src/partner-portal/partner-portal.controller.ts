import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { PartnerPortalService } from './partner-portal.service';
import { CreatePartnerProductDto } from './dto/create-partner-product.dto';
import { UpdatePartnerProductDto } from './dto/update-partner-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class PartnerPortalController {
  constructor(private service: PartnerPortalService) { }

  // ── PUBLIC — Partner Portal (auth par token) ──────────────

  @Get('partners/portal/:token')
  getPartnerByToken(@Param('token') token: string) {
    return this.service.getPartnerByToken(token);
  }

  @Get('partners/:slug/products')
  getPublicProducts(@Param('slug') slug: string) {
    return this.service.getPublicProducts(slug);
  }

  @Get('partner-products')
  getProducts(@Query('token') token: string) {
    return this.service.getProducts(token);
  }

  @Get('partner-portal/stats')
  getStats(@Query('token') token: string) {
    return this.service.getStats(token);
  }

  // Rapport mensuel (Business+)
  @Get('partner-portal/monthly-report')
  getMonthlyReport(@Query('token') token: string) {
    return this.service.getMonthlyReport(token);
  }

  // Commandes du partenaire
  @Get('partner-portal/orders')
  getOrders(@Query('token') token: string) {
    return this.service.getOrders(token);
  }

  @Post('partner-products')
  createProduct(@Body() dto: CreatePartnerProductDto) {
    return this.service.createProduct(dto);
  }

  @Patch('partner-products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdatePartnerProductDto) {
    return this.service.updateProduct(id, dto);
  }

  @Patch('partner-products/:id/toggle')
  toggleProduct(
    @Param('id') id: string,
    @Body('token') token: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.service.toggleProduct(id, token, isActive);
  }

  @Delete('partner-products/:id')
  deleteProduct(@Param('id') id: string, @Query('token') token: string) {
    return this.service.deleteProduct(id, token);
  }

  // Mise à jour statut commande
  @Patch('partner-portal/orders/:orderId/status')
  updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body('token') token: string,
    @Body('status') status: string,
  ) {
    return this.service.updateOrderStatus(orderId, token, status);
  }

  // ── ADMIN — Gestion des tokens ────────────────────────────

  @Post('partners/:id/token')
  @UseGuards(JwtAuthGuard)
  getOrCreateToken(@Param('id') id: string) {
    return this.service.getOrCreateToken(id);
  }

  @Delete('partners/:id/token')
  @UseGuards(JwtAuthGuard)
  revokeToken(@Param('id') id: string) {
    return this.service.revokeToken(id);
  }
}
