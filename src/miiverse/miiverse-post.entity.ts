export interface MiiversePost {
  id: number;
  user_id: number | null;       // null para posts de seeding
  username: string;
  mii_avatar_url: string;       // avatar del usuario
  content_text: string | null;
  drawing_url: string | null;   // URL de dibujo (canvas exportado)
  screenshot_url: string | null;
  game_title: string | null;    // comunidad/juego al que pertenece
  yeahs: number;
  created_at: Date;
  is_seed: boolean;
  is_spoiler: boolean;           // oculto hasta que el lector lo pulse
  comments_count: number;       // calculado al leer (no es columna)             // marca los posts de relleno
}

/** Orden de las listas de posts en comunidades y perfiles. */
export type PostSort = 'recent' | 'oldest' | 'popular';

/** Comunidad derivada de `game_title` (no hay tabla de comunidades). */
export interface MiiverseCommunity {
  name: string;
  posts_count: number;
  last_post_at: Date;
}

export interface MiiverseCommunityDetail {
  name: string;
  posts_count: number;
  yeahs_count: number;
  posts: MiiversePost[];
}

/** Perfil público calculado a partir de los posts del usuario. */
export interface MiiverseUserProfile {
  username: string;
  avatar_url: string | null;
  posts_count: number;
  yeahs_received: number;
  communities_count: number;
  first_post_at: Date;
  posts: MiiversePost[];
}

/** Resultado de la búsqueda de usuarios (solo usuarios con posts). */
export interface MiiverseUserSummary {
  username: string;
  avatar_url: string | null;
  posts_count: number;
}

/** Comentario de un post (fase 3). */
export interface MiiverseComment {
  id: number;
  post_id: number;
  user_id: number | null;
  username: string;
  mii_avatar_url: string | null;
  content_text: string;
  is_spoiler: boolean;
  created_at: Date;
}
