import { PostSort } from './miiverse-post.entity';

/*
 * Fragmentos de SQL que comparten varios servicios de Miiverse.
 * Nunca llevan texto del usuario: los valores van siempre como parámetros ($1, $2…).
 */

/**
 * Orden permitido -> fragmento SQL. Se usa una lista cerrada para no meter
 * nunca texto del usuario en el ORDER BY (evita inyección SQL).
 */
export const ORDER_BY: Record<PostSort, string> = {
  recent: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  popular: 'yeahs DESC, created_at DESC, id DESC',
};

/**
 * Clave normalizada de una comunidad, en SQL. Hace que "Splatoon 3",
 * "splatoon 3", "  SPLATOON   3 " o "Pokémon" / "Pokemon" sean la misma:
 * minúsculas, sin acentos, cualquier signo pasa a espacio y se compactan
 * los espacios. Se aplica al leer; en la BD se guarda lo que escribió el usuario.
 */
export function communityKey(sqlExpr: string): string {
  return `btrim(regexp_replace(
    translate(lower(${sqlExpr}), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', ' ', 'g'))`;
}
export const POST_COMMUNITY_KEY = communityKey('game_title');

/**
 * Dibujos: se siguen guardando en la BD (data URL PNG en `drawing_url`), pero
 * las respuestas JSON no llevan el dibujo, solo su ruta
 * (`/miiverse/posts/:id/drawing`, NULL si el post no tiene dibujo). Así el feed
 * pesa unos KB en vez de ~45 KB por dibujo, y el navegador descarga y guarda en
 * caché cada dibujo aparte.
 *
 * La ruta es relativa a propósito: el frontend le pone delante la dirección del
 * backend desde la que se abrió la página (`localhost` o la IP de la red).
 */
export function drawingPath(alias: string): string {
  return `CASE WHEN ${alias}.drawing_url IS NULL THEN NULL
               ELSE '/miiverse/posts/' || ${alias}.id || '/drawing' END`;
}

/**
 * Columnas de un post tal como las devuelve la API (sin el número de
 * comentarios). `drawing_url` es la ruta del dibujo, no el dibujo.
 * Exige que la tabla se llame `p`.
 */
export const POST_FIELDS = `p.id, p.user_id, p.username, p.mii_avatar_url, p.content_text,
  ${drawingPath('p')} AS drawing_url, p.screenshot_url, p.game_title, p.yeahs,
  p.created_at, p.is_seed, p.is_spoiler`;

/**
 * Columnas que devuelve cualquier lectura de posts: las de `POST_FIELDS` más
 * el número de comentarios. Exige que la tabla se llame `p` en el FROM.
 */
export const POST_COLUMNS = `${POST_FIELDS},
  (SELECT COUNT(*)::int FROM miiverse_comments c WHERE c.post_id = p.id) AS comments_count`;
