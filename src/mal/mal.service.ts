import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Formato que esperan los billboards del frontend (interfaz SteamGame). */
export interface BillboardItem {
  appid: number;
  name: string;
  author: string;
  image: string;
}

interface AniListMedia {
  title: { userPreferred: string | null; english: string | null };
  coverImage: { extraLarge: string | null; large: string | null };
  studios: { nodes: { name: string }[] };
  staff: { nodes: { name: { full: string } }[] };
}

type MediaType = 'ANIME' | 'MANGA';

/**
 * Top Anime y Top Manga.
 *
 * Antes usaba Jikan (API no oficial de MyAnimeList), pero dejó de responder
 * desde la red del proyecto (la conexión se agota). Ahora usa la API GraphQL
 * pública de AniList: gratis, sin clave y con límite de 90 peticiones/minuto.
 * La caché de 1 hora deja el consumo muy por debajo de ese límite.
 */
@Injectable()
export class MalService {
  private readonly logger = new Logger(MalService.name);
  private readonly anilistUrl = 'https://graphql.anilist.co';
  private readonly CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hora
  private readonly cache = new Map<MediaType, { data: BillboardItem[]; time: number }>();

  // Pedimos solo los campos que usamos; isAdult:false evita contenido +18.
  private readonly query = `
    query ($type: MediaType, $sort: [MediaSort]) {
      Page(perPage: 5) {
        media(type: $type, sort: $sort, isAdult: false) {
          title { userPreferred english }
          coverImage { extraLarge large }
          studios(isMain: true) { nodes { name } }
          staff(perPage: 1, sort: RELEVANCE) { nodes { name { full } } }
        }
      }
    }
  `;

  constructor(private configService: ConfigService) {}

  private wrapProxy(url: string): string {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    return `${baseUrl}/games/proxy?url=${encodeURIComponent(url)}`;
  }

  /** Anime más populares (equivale al antiguo "Most Popular"). */
  getTopAnime() {
    return this.getTop('ANIME', 'POPULARITY_DESC', 6000);
  }

  /** Manga mejor valorados (equivale al antiguo "Top Rated"). */
  getTopManga() {
    return this.getTop('MANGA', 'SCORE_DESC', 7000);
  }

  private async getTop(type: MediaType, sort: string, idBase: number): Promise<BillboardItem[]> {
    const cached = this.cache.get(type);
    if (cached && Date.now() - cached.time < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      this.logger.log(`🌐 Solicitando top ${type} a AniList...`);
      const res = await fetch(this.anilistUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: this.query, variables: { type, sort: [sort] } }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`AniList respondió ${res.status}`);
      }

      const json = await res.json();
      const media: AniListMedia[] = json?.data?.Page?.media ?? [];

      const result = media.map((item, index) => {
        const cover = item.coverImage.extraLarge ?? item.coverImage.large;
        // Anime: estudio principal. Manga: autor (primer miembro del staff).
        const author =
          type === 'ANIME' ? item.studios.nodes[0]?.name : item.staff.nodes[0]?.name.full;

        return {
          appid: idBase + index,
          name: item.title.english ?? item.title.userPreferred ?? 'Sin título',
          author: author ?? 'Unknown Author',
          image: cover ? this.wrapProxy(cover) : '',
        };
      });

      this.cache.set(type, { data: result, time: Date.now() });
      return result;
    } catch (e) {
      this.logger.error(`❌ Error obteniendo top ${type} de AniList: ${(e as Error).message}`);
      // Si falla, devolvemos lo último que funcionó (aunque esté caducado).
      return cached?.data ?? [];
    }
  }
}
