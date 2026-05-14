import {
  Controller, Post, Get, Patch,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private service: ServiceRequestsService) { }

  // ── PUBLIC ─────────────────────────────────────────────────

  /** Créer une demande (client) */
  @Post()
  create(@Body() dto: CreateServiceRequestDto) {
    return this.service.create(dto);
  }

  /** Missions ouvertes (PENDING, non assignées) — infos client masquées */
  @Get('open')
  getOpen(@Query('partnerToken') partnerToken: string) {
    return this.service.getOpen(partnerToken);
  }

  /** Missions assignées à CE prestataire — infos client visibles */
  @Get('assigned')
  getAssigned(@Query('partnerToken') partnerToken: string) {
    return this.service.getAssigned(partnerToken);
  }

  /** Intérêts exprimés par ce prestataire (liste des IDs) */
  @Get('my-interests')
  getMyInterests(@Query('partnerToken') partnerToken: string) {
    return this.service.getMyInterests(partnerToken);
  }

  /** Exprimer un intérêt pour une mission */
  @Post(':id/interest')
  expressInterest(
    @Param('id') id: string,
    @Body('partnerToken') partnerToken: string,
  ) {
    return this.service.expressInterest(id, partnerToken);
  }

  // ── ADMIN ──────────────────────────────────────────────────

  /** Toutes les demandes (admin) */
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('public')
  findPublic() {
    return this.service.getPublic();
  }

  /** Liste des prestataires intéressés pour une mission (admin) */
  @Get(':id/interests')
  @UseGuards(JwtAuthGuard)
  getInterests(@Param('id') id: string) {
    return this.service.getInterests(id);
  }

  /** Affecter une mission à un prestataire (admin) */
  @Post(':id/assign')
  @UseGuards(JwtAuthGuard)
  assign(
    @Param('id') id: string,
    @Body('partnerId') partnerId: string,
  ) {
    return this.service.assign(id, partnerId);
  }

  /** Changer le statut (admin ou prestataire) */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('partnerToken') partnerToken?: string,
  ) {
    return this.service.updateStatus(id, status, partnerToken);
  }


}
