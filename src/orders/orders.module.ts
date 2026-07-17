import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, NotificationsModule, PushModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
