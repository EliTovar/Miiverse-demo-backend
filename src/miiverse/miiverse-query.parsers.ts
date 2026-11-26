import { BadRequestException } from '@nestjs/common';
import type { ModerationFilters, PageQuery } from './miiverse.service';
import type { PostSort } from './miiverse-post.entity';

/*
 * Conversión y validación de los parámetros de la URL de /miiverse.
 * Son funciones puras: no tocan la BD y se prueban por separado.
 */

const SORTS: PostSort[] = ['recent', 'oldest', 'popular'];

/** Zona horaria IANA de la URL (por defecto UTC). 400 si no existe. */
export function toTimeZone(tz?: string): string {
  const timeZone = tz?.trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone }); // lanza RangeError si la zona no existe
  } catch {
    throw new BadRequestException('Zona horaria no válida');
  }
  return timeZone;
}

/**
 * Valida los filtros de moderación de la URL. Responde 400 si alguno tiene un
 * formato incorrecto, en vez de ignorarlo en silencio.
 */
export function toModerationFilters(q: Record<string, string | undefined>): ModerationFilters {
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined);

  const kind = q.type ?? 'all';
  if (!['all', 'post', 'comment'].includes(kind)) {
    throw new BadRequestException('type debe ser all, post o comment');
  }

  const timeZone = toTimeZone(q.tz);

  const date = clean(q.date);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) {
    throw new BadRequestException('date debe tener el formato AAAA-MM-DD');
  }
  const month = clean(q.month);
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new BadRequestException('month debe tener el formato AAAA-MM');
  }
  let hour: number | undefined;
  if (clean(q.hour) !== undefined) {
    hour = Number(q.hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new BadRequestException('hour debe ser un número de 0 a 23');
    }
  }

  return {
    kind: kind as ModerationFilters['kind'],
    text: clean(q.q),
    username: clean(q.user),
    community: clean(q.community),
    timeZone,
    date,
    month,
    hour,
  };
}

/** Avatar generado a partir del nombre (lo usan posts y comentarios). */
export function avatarFor(username: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0070f3&color=fff&bold=true&size=64`;
}

/**
 * Convierte los parámetros de la URL en una paginación segura: página >= 1,
 * límite entre 1 y 50 y un orden de la lista permitida (si no, 'recent').
 */
export function toPageQuery(page?: string, limit?: string, sort?: string): PageQuery {
  const pageNum = Math.max(1, Math.floor(Number(page)) || 1);
  const limitNum = Math.min(50, Math.max(1, Math.floor(Number(limit)) || 20));
  const sortValue = SORTS.includes(sort as PostSort) ? (sort as PostSort) : 'recent';
  return { page: pageNum, limit: limitNum, sort: sortValue };
}
