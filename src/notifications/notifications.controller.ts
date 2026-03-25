import { Controller, Get, Patch, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get('unread-count')
  countUnread() { return this.service.countUnread(); }

  @Patch('mark-all-read')
  markAllRead() { return this.service.markAllRead(); }

  @Patch(':id/read')
  markRead(@Param('id') id: string) { return this.service.markRead(id); }
}
