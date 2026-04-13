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
