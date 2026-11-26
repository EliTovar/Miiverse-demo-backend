import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  MiiverseCommunity,
  MiiverseCommunityDetail,
  MiiversePost,
  PageQuery,
} from './miiverse-post.entity';
import {
  ORDER_BY,
  POST_COLUMNS,
  POST_COMMUNITY_KEY,
  communityKey,
} from './miiverse-sql';

/**
 * Comunidades estilo Archiverse. No tienen tabla propia: salen de
 * `game_title` de los posts.
 */
@Injectable()
export class CommunitiesService {
  constructor(private readonly db: DatabaseService) {}

  async getCommunities(search?: string): Promise<MiiverseCommunity[]> {
    const term = search?.trim();
    return this.db.query<MiiverseCommunity>(
      // Se agrupa por la clave normalizada. Como nombre visible se usa la
      // variante más escrita (mode); si empatan, la primera alfabéticamente.
      `SELECT MODE() WITHIN GROUP (ORDER BY game_title) AS name,
              COUNT(*)::int AS posts_count,
              MAX(created_at) AS last_post_at
         FROM miiverse_posts
        WHERE ${POST_COMMUNITY_KEY} <> ''
          AND ($1::text IS NULL OR ${POST_COMMUNITY_KEY} LIKE '%' || ${communityKey('$1')} || '%')
        GROUP BY ${POST_COMMUNITY_KEY}
        ORDER BY posts_count DESC, name ASC`,
      [term ? term : null],
    );
  }

  async getCommunity(
    name: string,
    query: PageQuery,
  ): Promise<MiiverseCommunityDetail> {
    const [summary] = await this.db.query<
      Omit<MiiverseCommunityDetail, 'posts'>
    >(
      `SELECT MODE() WITHIN GROUP (ORDER BY game_title) AS name,
              COUNT(*)::int AS posts_count,
              COALESCE(SUM(yeahs), 0)::int AS yeahs_count
         FROM miiverse_posts
        WHERE ${POST_COMMUNITY_KEY} = ${communityKey('$1')}
          AND ${POST_COMMUNITY_KEY} <> ''`,
      [name],
    );
    if (!summary || summary.posts_count === 0)
      throw new NotFoundException('La comunidad no existe');

    const posts = await this.db.query<MiiversePost>(
      `SELECT ${POST_COLUMNS} FROM miiverse_posts p
        WHERE ${POST_COMMUNITY_KEY} = ${communityKey('$1')} AND ${POST_COMMUNITY_KEY} <> ''
        ORDER BY ${ORDER_BY[query.sort]} LIMIT $2 OFFSET $3`,
      [name, query.limit, (query.page - 1) * query.limit],
    );
    return { ...summary, posts };
  }
}
