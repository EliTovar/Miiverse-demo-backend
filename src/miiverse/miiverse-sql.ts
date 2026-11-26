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
 * Columnas que devuelve cualquier lectura de posts: todas las de la tabla más
 * el número de comentarios. Exige que la tabla se llame `p` en el FROM.
 */
export const POST_COLUMNS = `p.*,
  (SELECT COUNT(*)::int FROM miiverse_comments c WHERE c.post_id = p.id) AS comments_count`;
