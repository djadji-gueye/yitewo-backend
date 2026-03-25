import { Module } from '@nestjs/common';
import { PartnerPortalService } from './partner-portal.service';
import { PartnerPortalController } from './partner-portal.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [PartnerPortalService],
  controllers: [PartnerPortalController],
  exports: [PartnerPortalService],
})
export class PartnerPortalModule {}
