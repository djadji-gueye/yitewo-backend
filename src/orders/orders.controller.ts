import { Controller, Post, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) { return this.service.create(dto); }

  @Get()
  findAll(
    @Query('partnerToken') partnerToken?: string,
    @Query('partner')      partnerId?:    string,
  ) {
    if (partnerToken) return this.service.findByPartnerToken(partnerToken);
    return this.service.findAll(partnerId);
  }

  @Get('stats')
  stats() { return this.service.stats(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
