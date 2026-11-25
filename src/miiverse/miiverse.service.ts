import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePostDto } from './dto/create-post.dto';
import {
  MiiverseCommunity,
  MiiverseCommunityDetail,
  MiiversePost,
  MiiverseUserProfile,
  PostSort,
} from './miiverse-post.entity';

/**
 * Orden permitido -> fragmento SQL. Se usa una lista cerrada para no meter
 * nunca texto del usuario en el ORDER BY (evita inyección SQL).
 */
const ORDER_BY: Record<PostSort, string> = {
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
function communityKey(sqlExpr: string): string {
  return `btrim(regexp_replace(
    translate(lower(${sqlExpr}), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', ' ', 'g'))`;
}
const POST_COMMUNITY_KEY = communityKey('game_title');

/** Paginación ya validada que reciben los métodos de lectura. */
export interface PageQuery {
  page: number;
  limit: number;
  sort: PostSort;
}

// ─── Seed data ────────────────────────────────────────────────────────────────
// Datos de inicio inspirados en publicaciones reales de Miiverse.
// Las imágenes drawimgs son del repositorio público de Archiverse/Miiverse.
const SEED_POSTS = [
  {
    username: 'ZeldaMaster99',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=ZM&background=2ecc71&color=fff&bold=true&size=64',
    content_text: '¡Por fin terminé Breath of the Wild! La batalla final me costó mucho pero lo logré 💪',
    drawing_url: 'https://i.imgur.com/7bMqysS.png',
    screenshot_url: null,
    game_title: 'The Legend of Zelda: Breath of the Wild',
  },
  {
    username: 'SplatoonKing',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=SK&background=e74c3c&color=fff&bold=true&size=64',
    content_text: 'Acabo de llegar al rango S+ en Turf War 🦑🎨 ¡Nadie pare los tentáculos!',
    drawing_url: 'https://i.imgur.com/wkabCDQ.png',
    screenshot_url: null,
    game_title: 'Splatoon 3',
  },
  {
    username: 'MarioMaker2Fan',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=MM&background=e67e22&color=fff&bold=true&size=64',
    content_text: 'Mi nuevo nivel en Super Mario Maker 2 ya está disponible. ¡A ver quién puede terminarlo sin morir!',
    drawing_url: null,
    screenshot_url: 'https://i.imgur.com/xHjVsLQ.png',
    game_title: 'Super Mario Maker 2',
  },
  {
    username: 'PikminAdventurer',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=PA&background=27ae60&color=fff&bold=true&size=64',
    content_text: 'Dibujé a mi Pikmin favorito 🌿 El Pikmin roca es demasiado adorable',
    drawing_url: 'https://i.imgur.com/bGJCFiF.png',
    screenshot_url: null,
    game_title: 'Pikmin 4',
  },
  {
    username: 'AnimalCrossingIsla',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=AC&background=f39c12&color=fff&bold=true&size=64',
    content_text: 'Mi isla ya tiene 5 estrellas con Isabelle 🌟 Tantas horas de trabajo valieron la pena',
    drawing_url: 'https://i.imgur.com/nkXwf1r.png',
    screenshot_url: null,
    game_title: 'Animal Crossing: New Horizons',
  },
  {
    username: 'KirbyArtist',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=KA&background=ff69b4&color=fff&bold=true&size=64',
    content_text: '¡Kirby con habilidad de copiar espada es simplemente el más poderoso! 🌟',
    drawing_url: 'https://i.imgur.com/pWyX3LH.png',
    screenshot_url: null,
    game_title: 'Kirby and the Forgotten Land',
  },
  {
    username: 'SmashBrosPro',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=SB&background=9b59b6&color=fff&bold=true&size=64',
    content_text: 'Llevo 300 horas en Smash Ultimate y aún sigo mejorando con Link 🗡️ ¡El juego nunca envejece!',
    drawing_url: null,
    screenshot_url: 'https://i.imgur.com/d8Gb5rK.png',
    game_title: 'Super Smash Bros. Ultimate',
  },
  {
    username: 'MetroidHunter',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=MH&background=e74c3c&color=fff&bold=true&size=64',
    content_text: 'Samus en Metroid Dread es BRUTAL. La sensación al esquivar a los EMMI no tiene precio 💀',
    drawing_url: 'https://i.imgur.com/5BjGFHI.png',
    screenshot_url: null,
    game_title: 'Metroid Dread',
  },
  {
    username: 'FoxMcCloud64',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=FC&background=1a252f&color=fff&bold=true&size=64',
    content_text: 'DO A BARREL ROLL! Star Fox 64 sigue sin envejecer 🚀🦊',
    drawing_url: 'https://i.imgur.com/OjY5kWj.png',
    screenshot_url: null,
    game_title: 'Star Fox 64',
  },
  {
    username: 'PokemonTrainer',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=PT&background=e74c3c&color=fff&bold=true&size=64',
    content_text: 'Finalmente entrené mi primer equipo competitivo 6vs6. Lleva semanas pero valió la pena 🏆',
    drawing_url: 'https://i.imgur.com/yTzKw4D.png',
    screenshot_url: null,
    game_title: 'Pokémon Escarlata y Púrpura',
  },
  {
    username: 'NintendoFan_MX',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=NF&background=c0392b&color=fff&bold=true&size=64',
    content_text: 'Pintando al estilo Miiverse es lo más relajante que existe 😌🎨',
    drawing_url: 'https://i.imgur.com/3gTUiYc.png',
    screenshot_url: null,
    game_title: 'Wii U & Switch Community Art',
  },
  {
    username: 'WaluigiTime',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=WT&background=8e44ad&color=fff&bold=true&size=64',
    content_text: 'WALUIGI NUMBER ONE!!! 🎾 El mundo me debe un juego propio',
    drawing_url: 'https://i.imgur.com/u4Qze3T.png',
    screenshot_url: null,
    game_title: 'Mario Tennis Aces',
  },
  {
    username: 'BotWExplorer',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=BE&background=3498db&color=fff&bold=true&size=64',
    content_text: 'Mapa del Santuario más difícil de encontrar completado ✅ ¡El mundo abierto de Zelda es infinito!',
    drawing_url: null,
    screenshot_url: 'https://i.imgur.com/F7fYd4C.png',
    game_title: 'The Legend of Zelda: Tears of the Kingdom',
  },
  {
    username: 'DonkeyKongFan',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=DK&background=8B4513&color=fff&bold=true&size=64',
    content_text: 'Tropical Freeze sigue siendo el juego de plataformas más difícil que he jugado. Enorme DK 🍌',
    drawing_url: 'https://i.imgur.com/8JkQxBY.png',
    screenshot_url: null,
    game_title: 'Donkey Kong Country: Tropical Freeze',
  },
  {
    username: 'YoshiArtist',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=YA&background=2ecc71&color=fff&bold=true&size=64',
    content_text: '¡Mi dibujo de Yoshi de hoy! Practicando el estilo crayón que tiene el juego 🦎💚',
    drawing_url: 'https://i.imgur.com/MmKAbQR.png',
    screenshot_url: null,
    game_title: "Yoshi's Crafted World",
  },
  {
    username: 'BayonettaDancer',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=BD&background=2c3e50&color=fff&bold=true&size=64',
    content_text: 'La cámara lenta en los ataques de Bayonetta es una obra de arte en sí misma 🔫💫',
    drawing_url: null,
    screenshot_url: 'https://i.imgur.com/RFcl9jJ.png',
    game_title: 'Bayonetta 3',
  },
  {
    username: 'XenobladeChronicles',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=XC&background=e91e63&color=fff&bold=true&size=64',
    content_text: '300 horas de juego y el mundo de Xenoblade Chronicles 3 todavía me sorprende ✨',
    drawing_url: 'https://i.imgur.com/F5Xm8hY.png',
    screenshot_url: null,
    game_title: 'Xenoblade Chronicles 3',
  },
  {
    username: 'MarineFishFan',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=MF&background=1abc9c&color=fff&bold=true&size=64',
    content_text: 'Dibujé al equipo de Splatoon con estilo anime ¡Las tintas del juego me inspiran demasiado! 🦑',
    drawing_url: 'https://i.imgur.com/Xj9Wfb3.png',
    screenshot_url: null,
    game_title: 'Splatoon 3',
  },
  {
    username: 'FireEmblemWarrior',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=FE&background=c0392b&color=fff&bold=true&size=64',
    content_text: 'El sistema de clases en Fire Emblem Engage es adictivo. Mis personajes favoritos acaban de evol. ⚔️',
    drawing_url: null,
    screenshot_url: 'https://i.imgur.com/9nPKv6R.png',
    game_title: 'Fire Emblem Engage',
  },
  {
    username: 'MarioOdysseyRun',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=MO&background=e74c3c&color=fff&bold=true&size=64',
    content_text: '999 lunas recolectadas en Super Mario Odyssey 🌙 Gracias a Cappy por todo 🎩',
    drawing_url: 'https://i.imgur.com/tXmPvHB.png',
    screenshot_url: null,
    game_title: 'Super Mario Odyssey',
  },
];

@Injectable()
export class MiiverseService implements OnModuleInit {
  private readonly logger = new Logger(MiiverseService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    await this.initSchema();
    await this.seedPosts();
  }

  // ─── Schema ────────────────────────────────────────────────────────────────
  private async initSchema() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS miiverse_posts (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username         VARCHAR(100) NOT NULL,
        mii_avatar_url   TEXT,
        content_text     TEXT,
        drawing_url      TEXT,
        screenshot_url   TEXT,
        game_title       VARCHAR(200),
        yeahs            INTEGER DEFAULT 0,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        is_seed          BOOLEAN DEFAULT FALSE
      );
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS miiverse_yeahs (
        post_id  INTEGER REFERENCES miiverse_posts(id) ON DELETE CASCADE,
        user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, user_id)
      );
    `);

    this.logger.log('✅ Schema de Miiverse verificado');
  }

  // ─── Seed ──────────────────────────────────────────────────────────────────
  private async seedPosts() {
    const [{ count }] = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM miiverse_posts WHERE is_seed = TRUE`,
    );

    if (parseInt(count) > 0) {
      this.logger.log('📦 Seed posts ya existen, saltando...');
      return;
    }

    this.logger.log('🌱 Insertando seed posts en Miiverse...');
    for (const post of SEED_POSTS) {
      // Timestamp aleatorio entre ahora y 7 días atrás para naturalidad
      const randomHoursAgo = Math.floor(Math.random() * 168);
      const createdAt = new Date(Date.now() - randomHoursAgo * 60 * 60 * 1000);
      const yeahs = Math.floor(Math.random() * 120) + 1;

      await this.db.query(
        `INSERT INTO miiverse_posts
           (username, mii_avatar_url, content_text, drawing_url, screenshot_url, game_title, yeahs, created_at, is_seed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)`,
        [
          post.username,
          post.mii_avatar_url,
          post.content_text,
          post.drawing_url,
          post.screenshot_url,
          post.game_title,
          yeahs,
          createdAt.toISOString(),
        ],
      );
    }
    this.logger.log(`✅ ${SEED_POSTS.length} seed posts insertados en Miiverse`);
  }

  // ─── Feed ──────────────────────────────────────────────────────────────────
  async getFeed(page = 1, limit = 20): Promise<MiiversePost[]> {
    const offset = (page - 1) * limit;
    return this.db.query<MiiversePost>(
      `SELECT * FROM miiverse_posts ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
  }

  // ─── Create post ───────────────────────────────────────────────────────────
  async createPost(
    dto: CreatePostDto,
    userId: number,
    username: string,
    avatarUrl: string,
  ): Promise<MiiversePost> {
    const result = await this.db.query<MiiversePost>(
      `INSERT INTO miiverse_posts
         (user_id, username, mii_avatar_url, content_text, drawing_url, screenshot_url, game_title, is_seed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE)
       RETURNING *`,
      [
        userId,
        username,
        avatarUrl,
        dto.content_text ?? null,
        dto.drawing_url ?? null,
        dto.screenshot_url ?? null,
        dto.game_title ?? null,
      ],
    );
    return result[0];
  }

  // ─── Yeah (Me gusta) ───────────────────────────────────────────────────────
  async toggleYeah(postId: number, userId: number): Promise<{ yeahs: number }> {
    // Revisar si ya dio yeah
    const existing = await this.db.query(
      `SELECT 1 FROM miiverse_yeahs WHERE post_id=$1 AND user_id=$2`,
      [postId, userId],
    );

    if (existing.length > 0) {
      // Quitar yeah
      await this.db.query(
        `DELETE FROM miiverse_yeahs WHERE post_id=$1 AND user_id=$2`,
        [postId, userId],
      );
      await this.db.query(
        `UPDATE miiverse_posts SET yeahs = yeahs - 1 WHERE id=$1`,
        [postId],
      );
    } else {
      // Dar yeah
      await this.db.query(
        `INSERT INTO miiverse_yeahs(post_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [postId, userId],
      );
      await this.db.query(
        `UPDATE miiverse_posts SET yeahs = yeahs + 1 WHERE id=$1`,
        [postId],
      );
    }

    const [{ yeahs }] = await this.db.query<{ yeahs: number }>(
      `SELECT yeahs FROM miiverse_posts WHERE id=$1`,
      [postId],
    );
    return { yeahs };
  }

  // ─── Lectura estilo Archiverse (fase 2) ────────────────────────────────────
  // Las comunidades no tienen tabla propia: salen de `game_title` de los posts.

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

  async getCommunity(name: string, query: PageQuery): Promise<MiiverseCommunityDetail> {
    const [summary] = await this.db.query<Omit<MiiverseCommunityDetail, 'posts'>>(
      `SELECT MODE() WITHIN GROUP (ORDER BY game_title) AS name,
              COUNT(*)::int AS posts_count,
              COALESCE(SUM(yeahs), 0)::int AS yeahs_count
         FROM miiverse_posts
        WHERE ${POST_COMMUNITY_KEY} = ${communityKey('$1')}
          AND ${POST_COMMUNITY_KEY} <> ''`,
      [name],
    );
    if (!summary || summary.posts_count === 0) throw new NotFoundException('La comunidad no existe');

    const posts = await this.db.query<MiiversePost>(
      `SELECT * FROM miiverse_posts
        WHERE ${POST_COMMUNITY_KEY} = ${communityKey('$1')} AND ${POST_COMMUNITY_KEY} <> ''
        ORDER BY ${ORDER_BY[query.sort]} LIMIT $2 OFFSET $3`,
      [name, query.limit, (query.page - 1) * query.limit],
    );
    return { ...summary, posts };
  }

  async getPost(id: number): Promise<MiiversePost> {
    const [post] = await this.db.query<MiiversePost>(
      `SELECT * FROM miiverse_posts WHERE id = $1`,
      [id],
    );
    if (!post) throw new NotFoundException('La publicación no existe');
    return post;
  }

  /**
   * Perfil público a partir de los posts del usuario. Se busca por `username`
   * porque los posts de ejemplo no tienen `user_id`. No expone email ni rol.
   */
  async getUserProfile(username: string, query: PageQuery): Promise<MiiverseUserProfile> {
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
    if (!summary) throw new NotFoundException('El usuario no tiene publicaciones');

    const posts = await this.db.query<MiiversePost>(
      `SELECT * FROM miiverse_posts WHERE username = $1
        ORDER BY ${ORDER_BY[query.sort]} LIMIT $2 OFFSET $3`,
      [username, query.limit, (query.page - 1) * query.limit],
    );
    return { ...summary, posts };
  }
}
