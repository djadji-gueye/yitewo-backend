import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessesService } from './businesses.service';
import { CreateBusinessListingDto } from './dto/create-business-listing.dto';
import { UpdateBusinessListingStatusDto } from './dto/update-business-listing-status.dto';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Post()
  create(@Body() dto: CreateBusinessListingDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({ city, category, status });
  }

  @Get('map')
  findMap() {
    return this.service.findMap();
  }

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
  ) {
    return this.service.search({ q, city, category });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Patch(':id/claim')
  claim(@Param('id') id: string) {
    return this.service.claim(id);
  }

  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard)
  verify(@Param('id') id: string, @Body() dto: UpdateBusinessListingStatusDto) {
    return this.service.verify(id, dto);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  reject(@Param('id') id: string, @Body() dto: UpdateBusinessListingStatusDto) {
    return this.service.reject(id, dto);
  }
}
