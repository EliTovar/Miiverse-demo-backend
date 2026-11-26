import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EXTERNAL_TIMEOUT_MS,
  TtlCache,
  proxyImageUrl,
  randomUserAgent,
} from '../common/external-http';

@Injectable()
export class PixivService {
  private readonly logger = new Logger(PixivService.name);
 
  constructor(private configService: ConfigService) {}

  // Caché de 1 hora. Equilibrio entre actualización rápida e inmunidad a bloqueos.
  private readonly cache = new TtlCache<any[]>(1 * 60 * 60 * 1000);

  async getDailyRanking() {
    // Si hay datos en caché y no ha pasado 1 hora, devolvemos la caché
    const cached = this.cache.fresh;
    if (cached) {
      this.logger.log('📦 Retornando ranking de Pixiv desde la CACHÉ en memoria.');
      return cached;
    }

    try {
      this.logger.log('🌐 Solicitando nuevos datos frescos a Pixiv...');


      // URL actual: https://www.pixiv.net/ranking.php?mode=daily&content=manga (Manga All Ages)
      const res = await fetch('https://www.pixiv.net/ranking.php?mode=daily&content=manga', {
        signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
        headers: {
          'User-Agent': randomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://www.pixiv.net/',
          'DNT': '1' // Petición de "Do Not Track"
        }
      });
      const html = await res.text();
      
      const items: { id: string; title: string; author: string }[] = [];
      
      // Pixiv Ranking usa un estado JSON incrustado. 
      // La forma más robusta de extraerlo es dividir por el inicio de cada objeto de obra.
      const blocks = html.split('{"title":');
      
      blocks.slice(1).forEach(block => {
        const titleMatch = block.match(/^"([^"]+)"/);
        const idMatch = block.match(/"illust_id":(\d+)/);
        const userMatch = block.match(/"user_name":"([^"]+)"/);

        if (titleMatch && idMatch && userMatch) {
          const decode = (s: string) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          items.push({
            id: idMatch[1],
            title: decode(titleMatch[1]),
            author: decode(userMatch[1])
          });
        }
      });

      // Fallback a solo IDs si el scraping de títulos falla
      if (items.length === 0) {
        const idMatches = html.match(/\/artworks\/(\d+)/g);
        if (idMatches) {
            const uniqueIds = Array.from(new Set(idMatches.map(m => m.match(/\d+/)?.[0]).filter(id => id !== null)));
            for (let i = 0; i < Math.min(uniqueIds.length, 5); i++) {
                items.push({ id: uniqueIds[i] as string, title: `Manga ${uniqueIds[i]}`, author: 'Pixiv Artist' });
            }
        }
      }

      if (items.length === 0) throw new Error('No items parsed from Pixiv');

      const result = items.map((item, index) => ({
        appid: 8000 + index,
        name: item.title,
        author: item.author,
        image: proxyImageUrl(this.configService, `https://pixiv.cat/${item.id}.jpg`)
      }));

      // 💾 Guardar resultado exitoso en caché
      this.cache.set(result);
      this.logger.log('✅ Caché de Pixiv actualizada exitosamente. Próxima actualización en 1 hora.');

      return result;

    } catch (e) {
      this.logger.warn('⚠️ Pixiv Scraping failed, using high-quality fallback: ' + e.message);
      return this.getFallbackPixiv();
    }
  }

  private getFallbackPixiv() {
    // Lista de MANGAS populares VERIFICADOS hoy que funcionan con pixiv.cat
    return [
      { appid: 8001, name: 'Daily Manga 143408592', author: 'Pixiv Artist', image: proxyImageUrl(this.configService, 'https://pixiv.cat/143408592.jpg') },
      { appid: 8002, name: 'Daily Manga 143393681', author: 'Pixiv Artist', image: proxyImageUrl(this.configService, 'https://pixiv.cat/143393681.jpg') },
      { appid: 8003, name: 'Daily Manga 143385547', author: 'Pixiv Artist', image: proxyImageUrl(this.configService, 'https://pixiv.cat/143385547.jpg') },
      { appid: 8004, name: 'Daily Manga 143382597', author: 'Pixiv Artist', image: proxyImageUrl(this.configService, 'https://pixiv.cat/143382597.jpg') },
      { appid: 8005, name: 'Daily Manga 143378581', author: 'Pixiv Artist', image: proxyImageUrl(this.configService, 'https://pixiv.cat/143378581.jpg') }
    ];
  }
}
