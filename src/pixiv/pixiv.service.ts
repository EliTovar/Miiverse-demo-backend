import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PixivService {
  private readonly logger = new Logger(PixivService.name);
 
  // 🛡 Variables clave para el sistema de Caché local
  private cachedData: any[] | null = null;
  private lastFetchTime: number = 0;
  // Intervalo de 1 hora. Equilibrio entre actualización rápida e inmunidad a bloqueos.
  private readonly CACHE_DURATION = 1 * 60 * 60 * 1000; 

  private wrapProxy(url: string): string {
    return `http://192.168.100.15:3000/games/proxy?url=${encodeURIComponent(url)}`;
  }

  // 🕵️ Lista de User-Agents aleatorios para simular navegadores reales y evadir bloqueos
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  async getDailyRanking() {
    const now = Date.now();

    // 🏆 ¡Salvavidas! Si hay datos en caché y NO han pasado 6 horas, devolvemos la caché
    if (this.cachedData && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      this.logger.log('📦 Retornando ranking de Pixiv desde la CACHÉ en memoria.');
      return this.cachedData;
    }

    try {
      this.logger.log('🌐 Solicitando nuevos datos frescos a Pixiv...');
      // URL actual: https://www.pixiv.net/ranking.php?mode=daily&content=manga (Manga All Ages)
      const res = await fetch('https://www.pixiv.net/ranking.php?mode=daily&content=manga', {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
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
        image: this.wrapProxy(`https://pixiv.cat/${item.id}.jpg`)
      }));

      // 💾 Guardar resultado exitoso en caché
      this.cachedData = result;
      this.lastFetchTime = now;
      this.logger.log('✅ Caché de Pixiv actualizada exitosamente. Próxima actualización requerida en 6 horas.');

      return result;

    } catch (e) {
      this.logger.warn('⚠️ Pixiv Scraping failed, using high-quality fallback: ' + e.message);
      return this.getFallbackPixiv();
    }
  }

  private getFallbackPixiv() {
    // Lista de MANGAS populares VERIFICADOS hoy que funcionan con pixiv.cat
    return [
      { appid: 8001, name: 'Daily Manga 143408592', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143408592.jpg') },
      { appid: 8002, name: 'Daily Manga 143393681', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143393681.jpg') },
      { appid: 8003, name: 'Daily Manga 143385547', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143385547.jpg') },
      { appid: 8004, name: 'Daily Manga 143382597', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143382597.jpg') },
      { appid: 8005, name: 'Daily Manga 143378581', author: 'Pixiv Artist', image: this.wrapProxy('https://pixiv.cat/143378581.jpg') }
    ];
  }
}
