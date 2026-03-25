import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('scraper')
@UseGuards(JwtAuthGuard)
export class ScraperController {
  constructor(private service: ScraperService) {}

  // Déclencher un scraping manuel
  // POST /scraper/run/all
  // POST /scraper/run/expat-dakar-immo
  // POST /scraper/run/expat-dakar-emploi
  // POST /scraper/run/expat-dakar-services
  // POST /scraper/run/expat-dakar-ventes
  @Post('run/:source')
  run(@Param('source') source: string) {
    return this.service.runManual(source);
  }

  // Voir les sources disponibles
  @Get('sources')
  sources() {
    return {
      sources: [
        { id: 'all',                  label: 'Toutes les sources',            category: 'ALL' },
        { id: 'expat-dakar-immo',     label: 'Expat-Dakar — Appartements',    category: 'IMMOBILIER' },
        { id: 'expat-dakar-ventes',   label: 'Expat-Dakar — Ventes immo',     category: 'IMMOBILIER' },
        { id: 'expat-dakar-emploi',   label: 'Expat-Dakar — Emploi',          category: 'EMPLOI' },
        { id: 'expat-dakar-services', label: 'Expat-Dakar — Services',        category: 'SERVICE' },
      ],
      schedule: 'Chaque lundi à 06h00 (automatique)',
    };
  }
}
