import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);
  // 🛡 Variables de caché para Steam
  private cachedSteamData: any | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hora

  constructor(private configService: ConfigService) {}

  async getTrendingGames() {
    return this.fetchFromSteamStore('top_sellers');
  }

  async getRecentGames() {
    return this.fetchFromSteamStore('new_releases');
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

  private async fetchFromSteamStore(category: string) {
    const now = Date.now();
    let data = this.cachedSteamData;

    if (!data || (now - this.lastFetchTime) >= this.CACHE_DURATION) {
      try {
        console.log('🌐 Solicitando nuevos datos a Steam...');
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch('https://store.steampowered.com/api/featuredcategories', {
          signal: controller.signal,
          headers: {
             'User-Agent': this.getRandomUserAgent(),
             'Accept': 'application/json'
          }
        });
        clearTimeout(timeout);
        data = await response.json();
        
        // Guardar la respuesta completa en Caché
        this.cachedSteamData = data;
        this.lastFetchTime = now;
        console.log('✅ Caché de Steam actualizada exitosamente.');
      } catch (error) {
        console.error(`Error fetching Steam Store category [${category}]:`, error.message);
        // Si hay un error, usamos la caché vieja si existe, si no, retornamos vacío más abajo.
      }
    } else {
       console.log(`📦 Retornando Steam (${category}) desde la CACHÉ.`);
    }

    if (!data) return [];
      const items = data[category]?.items || [];
      
      // -------------------------------------------------------------------------
      // 🎮 CANTIDAD DE JUEGOS A MOSTRAR (MODIFICA AQUÍ)
      // Cambia el '5' por el número de juegos que prefieras (ej: 3, 5, 10).
      // -------------------------------------------------------------------------
      const gameLimit = 5; 
      // Steam a veces repite el mismo producto (mismo id) en la lista: nos quedamos
      // con la primera aparición para no mostrar duplicados.
      const uniqueItems = items.filter(
        (item: any, index: number) => items.findIndex((other: any) => other.id === item.id) === index,
      );
      const topGames = uniqueItems.slice(0, gameLimit);
      // -------------------------------------------------------------------------

      return Promise.all(topGames.map(async (item: any) => ({
        appid: item.id,
        name: item.name,
        image: this.wrapProxy(item.large_capsule_image || item.header_image)
      })));
  }

  private wrapProxy(url: string): string {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    return `${baseUrl}/games/proxy?url=${encodeURIComponent(url)}`;
  }

  async getImageUrl(appid: number): Promise<string> {
    const verticalUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900_2x.jpg`;
    const horizontalUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
    const ultimateFallback = `https://cdn.cloudflare.steamstatic.com/steam/apps/400/header.jpg`;

    try {
      const resV = await fetch(verticalUrl, { method: 'HEAD' });
      if (resV.ok) return verticalUrl;
      const resH = await fetch(horizontalUrl, { method: 'HEAD' });
      if (resH.ok) return horizontalUrl;
      return ultimateFallback;
    } catch {
      return ultimateFallback;
    }
  }
  // Método para el nuevo endpoint del controlador
  async fetchImage(url: string) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      if (!response.ok) {
        console.error(`❌ Proxy fetch failed for URL: ${url} | Status: ${response.status} ${response.statusText}`);
        throw new Error(`Image fetch failed with status ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      return {
        buffer: Buffer.from(buffer),
        contentType
      };
    } catch (e) {
      this.logger.error(`❌ Proxy error fetching image: ${url} | ${e.message}`);
      throw e;
    }
  }
}
