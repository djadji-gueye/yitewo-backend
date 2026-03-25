import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    OpportunitiesModule,
  ],
  providers: [ScraperService],
  controllers: [ScraperController],
})
export class ScraperModule {}
