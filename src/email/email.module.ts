// src/email/email.module.ts
import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTestController } from './email-test.controller';
import { EmailBroadcastController } from './email-broadcast.controller';

@Global() // Global = disponible partout sans re-importer
@Module({
    providers: [EmailService],
    controllers: [EmailTestController, EmailBroadcastController],
    exports: [EmailService],
})
export class EmailModule { }