import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  MiiversePost,
  MiiverseTopPlayer,
  MiiverseTopPlayers,
  MiiverseUserProfile,
  MiiverseUserSummary,
  PageQuery,
} from './miiverse-post.entity';
import { ORDER_BY, POST_COLUMNS, POST_COMMUNITY_KEY } from './miiverse-sql';

/** Usuarios vistos desde la red social: búsqueda, perfil público y Top Players. */
@Injectable()
export class ProfilesService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Búsqueda de usuarios por nombre (sin distinguir mayúsculas). Solo salen
   * quienes tienen posts, porque el perfil se construye a partir de ellos.
   * Sin texto devuelve los más activos. Máximo 30 resultados.
   */
  async searchUsers(search?: string): Promise<MiiverseUserSummary[]> {
    const term = search?.trim();
    return this.db.query<MiiverseUserSummary>(
      `SELECT username,
              (ARRAY_AGG(mii_avatar_url ORDER BY created_at DESC))[1] AS avatar_url,
              COUNT(*)::int AS posts_count
         FROM miiverse_posts
        WHERE $1::text IS NULL OR username ILIKE '%' || $1 || '%'
        GROUP BY username
        ORDER BY posts_count DESC, username ASC
        LIMIT 30`,
      [term ? term : null],
    );
  }

  /**
   * Perfil público a partir de los posts del usuario. Se busca por `username`
   * porque los posts de ejemplo no tienen `user_id`. No expone email ni rol.
   */
  async getUserProfile(
    username: string,
    query: PageQuery,
  ): Promise<MiiverseUserProfile> {
    const [summary] = await this.db.query<Omit<MiiverseUserProfile, 'posts'>>(
      `SELECT username,
              (ARRAY_AGG(mii_avatar_url ORDER BY created_at DESC))[1] AS avatar_url,
              COUNT(*)::int AS posts_count,
              COALESCE(SUM(yeahs), 0)::int AS yeahs_received,
              COUNT(DISTINCT NULLIF(${POST_COMMUNITY_KEY}, ''))::int AS communities_count,
              MIN(created_at) AS first_post_at
         FROM miiverse_posts
        WHERE username = $1
        GROUP BY username`,
      [username],
    );
    if (!summary)
      throw new NotFoundException('El usuario no tiene publicaciones');

    const posts = await this.db.query<MiiversePost>(
      `SELECT ${POST_COLUMNS} FROM miiverse_posts p WHERE username = $1
        ORDER BY ${ORDER_BY[query.sort]} LIMIT $2 OFFSET $3`,
      [username, query.limit, (query.page - 1) * query.limit],
    );
    return { ...summary, posts };
  }

  // ─── Top Players semanal ──────────────────────────────────────────────────

  /**
   * Los 5 usuarios que más Yeahs recibieron en sus publicaciones (dibujos o
   * texto) durante una semana de lunes a domingo, en la zona horaria `tz`.
   * `weeksAgo` = 0 es la semana actual, 1 la anterior, etc. Se cuenta cuándo
   * se dio cada Yeah (miiverse_yeahs.created_at), no cuándo se publicó el post.
   * Los Yeahs de ejemplo (contador aleatorio de los posts seed) no cuentan.
   */
  async getTopPlayers(
    weeksAgo: number,
    timeZone: string,
  ): Promise<MiiverseTopPlayers> {
    const players = await this.db.query<MiiverseTopPlayer>(
      `WITH week AS (
         SELECT (date_trunc('week', NOW() AT TIME ZONE $1) - ($2::int * INTERVAL '7 days')) AT TIME ZONE $1 AS start
       ),
       per_post AS (
         SELECT p.id, p.username, p.mii_avatar_url, p.drawing_url, p.created_at, COUNT(*)::int AS yeahs
           FROM miiverse_yeahs y
           JOIN miiverse_posts p ON p.id = y.post_id
           CROSS JOIN week w
          WHERE y.created_at >= w.start AND y.created_at < w.start + INTERVAL '7 days'
          GROUP BY p.id
       )
       SELECT username,
              SUM(yeahs)::int AS yeahs,
              COUNT(*)::int AS posts_count,
              (ARRAY_AGG(mii_avatar_url ORDER BY created_at DESC))[1] AS avatar_url,
              (ARRAY_AGG(id ORDER BY yeahs DESC, created_at DESC))[1] AS top_post_id,
              (ARRAY_AGG(drawing_url ORDER BY yeahs DESC, created_at DESC)
                 FILTER (WHERE drawing_url IS NOT NULL))[1] AS top_drawing_url
         FROM per_post
        GROUP BY username
        ORDER BY yeahs DESC, username ASC
        LIMIT 5`,
      [timeZone, weeksAgo],
    );
    const [{ start, end }] = await this.db.query<{ start: Date; end: Date }>(
      `SELECT (date_trunc('week', NOW() AT TIME ZONE $1) - ($2::int * INTERVAL '7 days')) AT TIME ZONE $1 AS start,
              (date_trunc('week', NOW() AT TIME ZONE $1) - (($2::int - 1) * INTERVAL '7 days')) AT TIME ZONE $1 AS "end"`,
      [timeZone, weeksAgo],
    );
    return { week_start: start, week_end: end, players };
  }
}
