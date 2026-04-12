import { Injectable } from '@nestjs/common';

@Injectable()
export class GamesService {
  async getTrendingGames() {
    return this.fetchFromSteamStore('top_sellers');
  }

  async getRecentGames() {
    return this.fetchFromSteamStore('new_releases');
  }

  private async fetchFromSteamStore(category: string) {
    try {
      const response = await fetch('https://store.steampowered.com/api/featuredcategories');
      const data = await response.json();
      const items = data[category]?.items || [];
      
      // -------------------------------------------------------------------------
      // 🎮 CANTIDAD DE JUEGOS A MOSTRAR (MODIFICA AQUÍ)
      // Cambia el '5' por el número de juegos que prefieras (ej: 3, 5, 10).
      // -------------------------------------------------------------------------
      const gameLimit = 5; 
      const topGames = items.slice(0, gameLimit);
      // -------------------------------------------------------------------------

      return Promise.all(topGames.map(async (item: any) => ({
        appid: item.id,
        name: item.name,
        image: this.wrapProxy(item.large_capsule_image || item.header_image)
      })));
    } catch (error) {
      console.error(`Error fetching Steam Store category [${category}]:`, error.message);
      return [];
    }
  }

  private wrapProxy(url: string): string {
    return `http://192.168.100.15:3000/games/proxy?url=${encodeURIComponent(url)}`;
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
      throw e;
    }
  }
}
