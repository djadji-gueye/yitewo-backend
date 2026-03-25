import { Module } from '@nestjs/common';
import { PartnerProductsService } from './partner-products.service';
import { PartnerProductsController } from './partner-products.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PartnerProductsService],
  controllers: [PartnerProductsController],
  exports: [PartnerProductsService],
})
export class PartnerProductsModule {}
