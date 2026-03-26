import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const start = Date.now();
    try {
      // Ping réel sur Supabase — empêche la mise en pause
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        db: 'connected',
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        db: 'unreachable',
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
