// src/email/email.module.ts
import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTestController } from './email-test.controller';

@Global() // Global = disponible partout sans re-importer
@Module({
    providers: [EmailService],
    controllers: [EmailTestController],
    exports: [EmailService],
})
export class EmailModule { }