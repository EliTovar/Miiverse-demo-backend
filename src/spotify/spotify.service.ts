import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EXTERNAL_TIMEOUT_MS,
  TtlCache,
  proxyImageUrl,
  randomUserAgent,
} from '../common/external-http';

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly limit = 5;

  constructor(private configService: ConfigService) {}

  // Caché de Spotify / Kworb: 1 hora
  private readonly cache = new TtlCache<any[]>(1 * 60 * 60 * 1000);

  async getTop5() {
    const cached = this.cache.fresh;
    if (cached) {
      this.logger.log('📦 Retornando Spotify Top 5 desde la CACHÉ.');
      return cached;
    }

    try {
      this.logger.log('🌐 Solicitando nuevos datos frescos a Kworb (Spotify)...');

      const response = await fetch('https://kworb.net/spotify/country/global_daily.html', {
        signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
        headers: {
          'User-Agent': randomUserAgent(),
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
            image: proxyImageUrl(this.configService, image)
          };
        })
      );

      // Guardar en caché
      this.cache.set(results);
      this.logger.log('✅ Caché de Spotify (Kworb) actualizada exitosamente.');

      return results;
    } catch (e) {
      this.logger.error('❌ Failed to fetch Spotify Top 5 from Kworb', e.stack);
      return this.cache.last || []; // Eliminamos getFallbackSongs() por petición del usuario
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
}
