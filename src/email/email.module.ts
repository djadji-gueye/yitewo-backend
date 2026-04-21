// src/email/email.module.ts
import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';

@Global() // Global = disponible partout sans re-importer
@Module({
    providers: [EmailService],
    exports: [EmailService],
})
export class EmailModule { }