import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { PartnerProductsService } from './partner-products.service';
import { CreatePartnerProductDto } from './dto/create-partner-product.dto';
import { UpdatePartnerProductDto } from './dto/update-partner-product.dto';
import { IsBoolean, IsString } from 'class-validator';

class ToggleDto {
  @IsString() token: string;
  @IsBoolean() isActive: boolean;
}

@Controller('partner-products')
export class PartnerProductsController {
  constructor(private service: PartnerProductsService) {}

  // Public : produits d'un partenaire par slug (page commande)
  @Get('public/:slug')
  findPublic(@Param('slug') slug: string) {
    return this.service.findPublicBySlug(slug);
  }

  // Portal : liste des produits du partenaire
  @Get()
  findAll(@Query('token') token: string) {
    return this.service.findAll(token);
  }

  // Portal : créer un produit
  @Post()
  create(@Body() dto: CreatePartnerProductDto) {
    return this.service.create(dto);
  }

  // Portal : modifier un produit
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerProductDto) {
    return this.service.update(id, dto);
  }

  // Portal : toggle actif/masqué
  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Body() body: ToggleDto) {
    return this.service.toggle(id, body.token, body.isActive);
  }

  // Portal : supprimer un produit
  @Delete(':id')
  remove(@Param('id') id: string, @Query('token') token: string) {
    return this.service.remove(id, token);
  }
}
