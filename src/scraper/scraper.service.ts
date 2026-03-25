import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OpportunitiesService } from '../opportunities/opportunities.service';

interface RawListing {
  title: string;
  url: string;
  price?: string;
  location: string;
  imageUrl?: string;
}

// On définit les sources avec plusieurs URL candidates à tester
const SOURCES = [
  {
    id: 'expat-dakar-immo',
    label: 'Immobilier',
    category: 'IMMOBILIER',
    candidates: [
      'https://www.expat-dakar.com/appartements-a-louer',
      'https://www.expat-dakar.com/immobilier',
      'https://www.expat-dakar.com/locations',
    ],
  },
  {
    id: 'expat-dakar-emploi',
    label: 'Emploi',
    category: 'EMPLOI',
    candidates: [
      'https://www.expat-dakar.com/emploi',
      'https://www.expat-dakar.com/offres-emploi',
      'https://www.expat-dakar.com/recrutement',
    ],
  },
  {
    id: 'expat-dakar-services',
    label: 'Services',
    category: 'SERVICE',
    candidates: [
      'https://www.expat-dakar.com/services',
      'https://www.expat-dakar.com/services-divers',
      'https://www.expat-dakar.com/prestation-services',
    ],
  },
  {
    id: 'expat-dakar-commerce',
    label: 'Commerce',
    category: 'COMMERCE',
    candidates: [
      'https://www.expat-dakar.com/commerce',
      'https://www.expat-dakar.com/vente',
      'https://www.expat-dakar.com/commerces-boutiques',
      'https://www.expat-dakar.com/boutiques',
    ],
  },
  {
    id: 'expat-dakar-formation',
    label: 'Formation',
    category: 'FORMATION',
    candidates: [
      'https://www.expat-dakar.com/formation',
      'https://www.expat-dakar.com/formations',
      'https://www.expat-dakar.com/cours-formations',
    ],
  },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Cache-Control': 'no-cache',
};

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  // Cache de la vraie URL trouvée pour chaque source
  private urlCache: Record<string, string> = {};

  constructor(private opportunities: OpportunitiesService) {}

  async runManual(source: string) {
    this.logger.log(`🚀 Scraping manuel: ${source}`);
    if (source === 'all') return this.runAll();
    const found = SOURCES.find((s) => s.id === source);
    if (!found) throw new Error(`Source inconnue: ${source}`);
    return this.scrapeSource(found);
  }

  @Cron('0 6 * * 1')
  async runWeekly() {
    this.logger.log('📅 Scraping hebdomadaire lancé');
    const purged = await this.opportunities.purgeOldExternal();
    this.logger.log(`🗑 ${purged} vieilles annonces supprimées`);
    await this.runAll();
    this.logger.log('✅ Scraping hebdomadaire terminé');
  }

  async runAll() {
    const results = await Promise.allSettled(
      SOURCES.map((s) => this.scrapeSource(s))
    );
    const summary = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { id: SOURCES[i].id, count: 0, error: String(r.reason) }
    );
    this.logger.log(`📊 Résumé: ${JSON.stringify(summary)}`);
    return summary;
  }

  // ── Scrape une source en testant les URLs candidates ──────
  private async scrapeSource(source: typeof SOURCES[0]) {
    // Si on a déjà une URL qui marche en cache, on l'utilise directement
    const cached = this.urlCache[source.id];
    if (cached) {
      try {
        const result = await this.scrapeUrl(cached, source);
        if (result.count > 0) return result;
      } catch { /* cache invalidé, on reteste */ }
    }

    // Teste chaque URL candidate jusqu'à en trouver une qui marche
    for (const url of source.candidates) {
      try {
        this.logger.log(`🔍 Teste: ${url}`);
        const result = await this.scrapeUrl(url, source);

        // Mémorise l'URL qui fonctionne
        this.urlCache[source.id] = url;
        this.logger.log(`✅ ${source.label} (${url}): ${result.count} annonces`);
        return result;
      } catch (e: any) {
        this.logger.warn(`⚠️ ${url}: ${e.message}`);
        // Petite pause entre les tentatives
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    this.logger.error(`❌ ${source.label}: aucune URL candidate ne fonctionne`);
    return { id: source.id, label: source.label, count: 0, error: 'Aucune URL valide trouvée' };
  }

  // ── Scrape une URL spécifique ─────────────────────────────
  private async scrapeUrl(url: string, source: { id: string; label: string; category: string }) {
    // Essai 1 : API _next/data (Next.js expose ça automatiquement)
    try {
      const nextDataUrl = url.replace(
        'https://www.expat-dakar.com',
        'https://www.expat-dakar.com/_next/data/BUILDID'
      ) + '.json';

      // On essaie de trouver le buildId dans la page HTML d'abord
      const html = await this.get(url);
      const buildIdMatch = /"buildId":"([^"]+)"/.exec(html);

      if (buildIdMatch) {
        const buildId = buildIdMatch[1];
        const apiUrl = `https://www.expat-dakar.com/_next/data/${buildId}${new URL(url).pathname}.json`;
        const res = await fetch(apiUrl, { headers: HEADERS });

        if (res.ok) {
          const data = await res.json();
          const items: any[] =
            data?.pageProps?.ads ||
            data?.pageProps?.listings ||
            data?.pageProps?.initialData?.ads ||
            data?.pageProps?.data ||
            [];

          if (items.length > 0) {
            const listings = this.normalizeItems(items, url);
            const count = await this.saveListings(listings, source.category, 'Expat-Dakar');
            return { id: source.id, label: source.label, count, method: '_next/data' };
          }
        }
      }

      // Même si _next/data échoue, on a déjà le HTML — on le parse
      const listings = this.parseHtml(html, url);
      const count = await this.saveListings(listings, source.category, 'Expat-Dakar');
      return { id: source.id, label: source.label, count, method: 'html' };

    } catch (e: any) {
      throw e;
    }
  }

  // ── GET avec vérification 404 ─────────────────────────────
  private async get(url: string): Promise<string> {
    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 404) throw new Error(`HTTP 404`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  // ── Normalise les items JSON ──────────────────────────────
  private normalizeItems(items: any[], baseUrl: string): RawListing[] {
    const domain = new URL(baseUrl).origin;
    return items
      .map((item: any) => {
        const rawUrl = item.url || item.link || item.permalink ||
          (item.slug ? `${domain}/${item.slug}` : '');
        return {
          title:    (item.title || item.subject || item.name || '').trim().slice(0, 100),
          url:      rawUrl.startsWith('http') ? rawUrl : `${domain}${rawUrl}`,
          price:    item.price?.toString() || item.prix?.toString(),
          location: item.location || item.ville || item.city || 'Dakar',
          imageUrl: item.image || item.thumbnail || item.photo,
        };
      })
      .filter((i) => i.title && i.url);
  }

  // ── Parse HTML multi-stratégie ────────────────────────────
  private parseHtml(html: string, baseUrl: string): RawListing[] {
    const seen = new Set<string>();
    const domain = new URL(baseUrl).origin;
    const listings: RawListing[] = [];

    // Stratégie 1 : __NEXT_DATA__
    const nd = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (nd) {
      try {
        const data = JSON.parse(nd[1]);
        const pp = data?.props?.pageProps;
        const items: any[] = pp?.ads || pp?.listings || pp?.initialAds || pp?.data?.ads || [];
        const normalized = this.normalizeItems(items, baseUrl)
          .filter((i) => !seen.has(i.url) && (seen.add(i.url), true));
        listings.push(...normalized);
        if (listings.length > 0) return listings.slice(0, 40);
      } catch { /* next */ }
    }

    // Stratégie 2 : JSON-LD
    const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let ldM;
    while ((ldM = ldRe.exec(html)) !== null) {
      try {
        const d = JSON.parse(ldM[1]);
        for (const item of Array.isArray(d) ? d : [d]) {
          if (!item.url || !item.name || seen.has(item.url)) continue;
          seen.add(item.url);
          listings.push({
            title: item.name.trim().slice(0, 100),
            url: item.url,
            price: item.offers?.price?.toString(),
            location: item.address?.addressLocality || 'Dakar',
            imageUrl: Array.isArray(item.image) ? item.image[0] : item.image,
          });
        }
      } catch { /* next */ }
    }
    if (listings.length > 0) return listings.slice(0, 40);

    // Stratégie 3 : liens avec ID numérique dans l'URL
    const re = /href="((?:https?:\/\/[^"]*expat-dakar[^"]*)?\/[a-z0-9-]+-(\d{4,})[^"]*)"[^>]*>\s*([^<]{8,100})\s*</gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const rawUrl = m[1];
      const title  = m[3].trim().replace(/\s+/g, ' ');
      const url    = rawUrl.startsWith('http') ? rawUrl : `${domain}${rawUrl}`;
      if (seen.has(url) || /nav|menu|footer|auth/i.test(url)) continue;
      seen.add(url);
      listings.push({ title: title.slice(0, 100), url, location: 'Dakar' });
    }

    return listings.slice(0, 40);
  }

  // ── Sauvegarde en base ────────────────────────────────────
  private async saveListings(listings: RawListing[], category: string, sourceName: string): Promise<number> {
    let count = 0;
    for (const item of listings) {
      if (!item.title || !item.url) continue;
      try {
        const slug =
          item.title.toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '').slice(0, 50) +
          '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

        await this.opportunities.upsertExternal({
          title: item.title, slug, category,
          location: item.location || 'Dakar',
          description: [
            `Annonce importée depuis ${sourceName}.`,
            item.price    ? `Prix : ${item.price}.`            : '',
            item.location ? `Localisation : ${item.location}.` : '',
            'Cliquez pour voir les détails complets sur le site source.',
          ].filter(Boolean).join(' '),
          price:     item.price,
          imageUrl:  item.imageUrl,
          sourceUrl: item.url,
          sourceName,
        });
        count++;
      } catch { /* ignore duplicates */ }
    }
    return count;
  }
}
