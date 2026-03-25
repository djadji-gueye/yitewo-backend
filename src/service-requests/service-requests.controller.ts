import { Controller, Post, Get, Patch, Param, Body } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';

@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private service: ServiceRequestsService) {}

  @Post()
  create(@Body() dto: CreateServiceRequestDto) { return this.service.create(dto); }

  @Get()
  findAll() { return this.service.findAll(); }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.service.updateStatus(id, status);
  }
}
