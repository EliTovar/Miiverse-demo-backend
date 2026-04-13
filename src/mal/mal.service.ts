import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MalService {
  private readonly logger = new Logger(MalService.name);
  private readonly jikanUrl = 'https://api.jikan.moe/v4';

  // 🛡 Variables de caché para Jikan (Top Anime y Manga)
  private cachedAnime: any[] | null = null;
  private lastAnimeFetch: number = 0;
  private cachedManga: any[] | null = null;
  private lastMangaFetch: number = 0;
  private readonly CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hora

  private wrapProxy(url: string): string {
    return `http://192.168.100.15:3000/games/proxy?url=${encodeURIComponent(url)}`;
  }

  // 🕵️ Lista de User-Agents aleatorios para evadir bloqueos
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  async getTopAnime() {
    const now = Date.now();
    if (this.cachedAnime && (now - this.lastAnimeFetch) < this.CACHE_DURATION) {
      this.logger.log('📦 Retornando Top Anime desde la CACHÉ.');
      return this.cachedAnime;
    }

    try {
      this.logger.log('🌐 Solicitando Top Anime a Jikan...');
      const res = await fetch(`${this.jikanUrl}/top/anime?limit=5`, {
        headers: { 'User-Agent': this.getRandomUserAgent() }
      });
      const data = await res.json();
      
      const result = data.data.map((item, index) => ({
        appid: 6000 + index,
        name: item.title,
        author: item.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
        image: this.wrapProxy(item.images.jpg.large_image_url)
      }));

      // Guardar en caché
      this.cachedAnime = result;
      this.lastAnimeFetch = now;
      return result;

    } catch (e) {
      this.logger.error('❌ Error fetching Top Anime from Jikan', e);
      return this.cachedAnime || [];
    }
  }

  async getTopManga() {
    const now = Date.now();
    if (this.cachedManga && (now - this.lastMangaFetch) < this.CACHE_DURATION) {
      this.logger.log('📦 Retornando Top Manga desde la CACHÉ.');
      return this.cachedManga;
    }

    try {
      this.logger.log('🌐 Solicitando Top Manga a Jikan...');
      const res = await fetch(`${this.jikanUrl}/top/manga?limit=5`, {
        headers: { 'User-Agent': this.getRandomUserAgent() }
      });
      const data = await res.json();
      
      const result = data.data.map((item, index) => ({
        appid: 7000 + index,
        name: item.title,
        author: item.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
        image: this.wrapProxy(item.images.jpg.large_image_url)
      }));

      // Guardar en caché
      this.cachedManga = result;
      this.lastMangaFetch = now;
      return result;

    } catch (e) {
      this.logger.error('❌ Error fetching Top Manga from Jikan', e);
      return this.cachedManga || [];
    }
  }
}
