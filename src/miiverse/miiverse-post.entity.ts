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
  is_seed: boolean;             // marca los posts de relleno
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
