import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  MiiverseModerationItem,
  ModerationFilters,
  PageQuery,
} from './miiverse-post.entity';
import { communityKey, drawingPath } from './miiverse-sql';

/** Vista de moderación (solo admin): posts y comentarios juntos con filtros. */
@Injectable()
export class ModerationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Moderación (solo admin): posts y comentarios juntos, del más nuevo al más
   * viejo, con filtros. Cada fila trae `total` (resultados de la búsqueda
   * completa, no solo de esta página). Día, mes y hora se calculan en la zona
   * horaria del moderador para que coincidan con lo que ve en pantalla.
   */
  async getModerationItems(
    f: ModerationFilters,
    page: PageQuery,
  ): Promise<MiiverseModerationItem[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    // La zona horaria solo se añade como parámetro si algún filtro de fecha la
    // usa (PostgreSQL rechaza parámetros que la consulta no usa).
    let tzParam: string | undefined;
    const local = () =>
      `(i.created_at AT TIME ZONE ${(tzParam ??= add(f.timeZone))}::text)`;

    if (f.kind !== 'all') where.push(`i.kind = ${add(f.kind)}`);
    if (f.text) where.push(`i.content_text ILIKE '%' || ${add(f.text)} || '%'`);
    if (f.username)
      where.push(`i.username ILIKE '%' || ${add(f.username)} || '%'`);
    if (f.community)
      where.push(
        `${communityKey('i.game_title')} = ${communityKey(add(f.community) + '::text')}`,
      );
    if (f.date) where.push(`${local()}::date = ${add(f.date)}::date`);
    if (f.month) where.push(`to_char(${local()}, 'YYYY-MM') = ${add(f.month)}`);
    if (f.hour !== undefined)
      where.push(`EXTRACT(HOUR FROM ${local()}) = ${add(f.hour)}`);

    const limit = add(page.limit);
    const offset = add((page.page - 1) * page.limit);

    return this.db.query<MiiverseModerationItem>(
      `SELECT i.*, COUNT(*) OVER()::int AS total
         FROM (
           SELECT 'post' AS kind, p.id, p.id AS post_id, p.username, p.mii_avatar_url,
                  p.content_text, ${drawingPath('p')} AS drawing_url, p.screenshot_url, p.game_title,
                  p.is_spoiler, p.created_at, p.yeahs,
                  (SELECT COUNT(*)::int FROM miiverse_comments c WHERE c.post_id = p.id) AS comments_count,
                  NULL::text AS post_text, NULL::varchar AS post_username
             FROM miiverse_posts p
           UNION ALL
           SELECT 'comment', c.id, c.post_id, c.username, c.mii_avatar_url,
                  c.content_text, NULL, NULL, p.game_title,
                  c.is_spoiler, c.created_at,
                  (SELECT COUNT(*)::int FROM miiverse_comment_yeahs y WHERE y.comment_id = c.id),
                  NULL,
                  p.content_text, p.username
             FROM miiverse_comments c
             JOIN miiverse_posts p ON p.id = c.post_id
         ) i
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY i.created_at DESC, i.kind, i.id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
  }
}
