import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly limit = 5;

  // 🛡 Variables de caché para Spotify / Kworb
  private cachedData: any[] | null = null;
  private lastFetchTime: number = 0;
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

  async getTop5() {
    const now = Date.now();
    if (this.cachedData && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      this.logger.log('📦 Retornando Spotify Top 5 desde la CACHÉ.');
      return this.cachedData;
    }

    try {
      this.logger.log('🌐 Solicitando nuevos datos frescos a Kworb (Spotify)...');
      const response = await fetch('https://kworb.net/spotify/country/global_daily.html', {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://kworb.net/'
        }
      });
      const html = await response.text();
      
      // Parsear la tabla de Kworb
      // Buscamos los enlaces que contienen /artist/ y /track/
      // Un patrón común es: <a href="artist/...">Artist</a></td><td class="text"><a href="track/...">Track</a>
      const songs: { artist: string; title: string }[] = [];
      const rowMatches = html.match(/<tr[\s\S]*?\/artist\/[\s\S]*?<\/tr>/g);

      if (rowMatches) {
        for (let i = 0; i < Math.min(rowMatches.length, this.limit); i++) {
          const row = rowMatches[i];
          const artistMatch = row.match(/\/artist\/[^>]+>([^<]+)/);
          const trackMatch = row.match(/\/track\/[^>]+>([^<]+)/);
          
          if (artistMatch && trackMatch) {
            songs.push({
              artist: artistMatch[1].trim(),
              title: trackMatch[1].trim()
            });
          }
        }
      }

      const results = await Promise.all(
        songs.map(async (song, index) => {
          const image = await this.getAlbumArt(song.artist, song.title);
          return {
            appid: 5000 + index, // IDs únicos para Spotify
            name: `${song.artist} - ${song.title}`,
            image: this.wrapProxy(image)
          };
        })
      );

      // Guardar en caché
      this.cachedData = results;
      this.lastFetchTime = now;
      this.logger.log('✅ Caché de Spotify (Kworb) actualizada exitosamente.');

      return results;
    } catch (e) {
      this.logger.error('❌ Failed to fetch Spotify Top 5 from Kworb', e.stack);
      return this.cachedData || this.getFallbackSongs();
    }
  }

  private async getAlbumArt(artist: string, title: string): Promise<string> {
    try {
      const searchTerm = encodeURIComponent(`${artist} ${title}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1`);
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        // Obtenemos la versión de alta resolución (600x600 o más si cambiamos el string)
        return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to fetch cover for ${artist} - ${title}`);
    }
    // Fallback image (Spotify logo o similar)
    return 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/08/Spotify_Logo_RGB_Green.png'; 
  }

  private getFallbackSongs() {
    return [
      { appid: 5001, name: 'Die With A Smile', author: 'Lady Gaga & Bruno Mars', image: this.wrapProxy('https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/0d/1b/3d0d1b6e-6e8e-c3c2-40f4-5f5f5f5f5f5f/24UMGIM74567.rgb.jpg/600x600bb.jpg') },
      { appid: 5002, name: 'BIRDS OF A FEATHER', author: 'Billie Eilish', image: this.wrapProxy('https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a3/0d/1b/a30d1b6e-6e8e-c3c2-40f4-5f5f5f5f5f5f/24UMGIM74567.rgb.jpg/600x600bb.jpg') },
      { appid: 5003, name: 'Espresso', author: 'Sabrina Carpenter', image: this.wrapProxy('https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b3/0d/1b/b30d1b6e-6e8e-c3c2-40f4-5f5f5f5f5f5f/24UMGIM74567.rgb.jpg/600x600bb.jpg') },
      { appid: 5004, name: 'Good Luck, Babe!', author: 'Chappell Roan', image: this.wrapProxy('https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c3/0d/1b/c30d1b6e-6e8e-c3c2-40f4-5f5f5f5f5f5f/24UMGIM74567.rgb.jpg/600x600bb.jpg') },
      { appid: 5005, name: 'I Had Some Help', author: 'Post Malone', image: this.wrapProxy('https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d3/0d/1b/d30d1b6e-6e8e-c3c2-40f4-5f5f5f5f5f5f/24UMGIM74567.rgb.jpg/600x600bb.jpg') }
    ];
  }
}
