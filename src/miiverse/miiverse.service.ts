import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto';
import {
  MiiverseModerationItem,
  MiiverseTopPlayer,
  MiiverseTopPlayers,
  MiiverseComment,
  MiiverseCommunity,
  MiiverseCommunityDetail,
  MiiversePost,
  MiiverseUserProfile,
  MiiverseUserSummary,
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

/**
 * Columnas que devuelve cualquier lectura de posts: todas las de la tabla más
 * el número de comentarios. Exige que la tabla se llame `p` en el FROM.
 */
const POST_COLUMNS = `p.*,
  (SELECT COUNT(*)::int FROM miiverse_comments c WHERE c.post_id = p.id) AS comments_count`;

/** Largo máximo del texto de un post (el compositor del frontend usa el mismo). */
const MAX_POST_LENGTH = 500;
/** Largo máximo del nombre de comunidad (columna VARCHAR(200)). */
const MAX_GAME_TITLE_LENGTH = 200;
/** Las imágenes de un post son siempre data URL PNG/JPEG generadas en el navegador. */
const IMAGE_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

/** Largo máximo de un comentario (igual que el texto de un post). */
const MAX_COMMENT_LENGTH = 500;

/**
 * Columnas que devuelve cualquier lectura de comentarios: las de la tabla,
 * cuántos Yeahs tiene y si el usuario que pregunta ya le dio Yeah.
 * `viewerParam` es el parámetro SQL con el id del usuario (NULL si es invitado).
 * Exige que la tabla se llame `c` en el FROM.
 */
function commentColumns(viewerParam: string): string {
  return `c.*,
    (SELECT COUNT(*)::int FROM miiverse_comment_yeahs y WHERE y.comment_id = c.id) AS yeahs,
    EXISTS (SELECT 1 FROM miiverse_comment_yeahs y
             WHERE y.comment_id = c.id AND y.user_id = ${viewerParam}) AS yeahed`;
}

/**
 * Valida y limpia lo que llega al publicar. Antes solo lo comprobaba el
 * frontend, así que una petición hecha a mano podía saltarse los límites.
 */
function cleanPostInput(dto: CreatePostDto | undefined) {
  const optionalText = (value: unknown, field: string, max: number): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw new BadRequestException(`${field} debe ser texto`);
    const text = value.trim();
    if (text.length > max) throw new BadRequestException(`${field} no puede pasar de ${max} caracteres`);
    return text || null;
  };
  const optionalImage = (value: unknown, field: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !IMAGE_DATA_URL.test(value)) {
      throw new BadRequestException(`${field} debe ser una imagen PNG o JPEG generada en la app`);
    }
    return value;
  };

  const content_text = optionalText(dto?.content_text, 'El texto', MAX_POST_LENGTH);
  const drawing_url = optionalImage(dto?.drawing_url, 'El dibujo');
  const screenshot_url = optionalImage(dto?.screenshot_url, 'La captura');
  const game_title = optionalText(dto?.game_title, 'La comunidad', MAX_GAME_TITLE_LENGTH);
  if (!content_text && !drawing_url && !screenshot_url) {
    throw new BadRequestException('La publicación necesita texto o un dibujo');
  }
  return { content_text, drawing_url, screenshot_url, game_title, is_spoiler: dto?.is_spoiler === true };
}

/** Valida y limpia el texto de un comentario (crear y editar). */
function cleanCommentText(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BadRequestException('El comentario no puede estar vacío');
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new BadRequestException(`El comentario no puede pasar de ${MAX_COMMENT_LENGTH} caracteres`);
  }
  return text;
}

/** Filtros ya validados de la vista de moderación (ver toModerationFilters en el controlador). */
export interface ModerationFilters {
  kind: 'all' | 'post' | 'comment';
  text?: string;
  username?: string;
  community?: string;
  /** Zona horaria IANA del moderador (p. ej. America/Mexico_City) para día/mes/hora. */
  timeZone: string;
  date?: string;   // YYYY-MM-DD
  month?: string;  // YYYY-MM
  hour?: number;   // 0-23
}

/** Paginación ya validada que reciben los métodos de lectura. */
export interface PageQuery {
  page: number;
  limit: number;
  sort: PostSort;
}

// ─── Seed data ────────────────────────────────────────────────────────────────
// Datos de inicio inspirados en publicaciones reales de Miiverse.
// Sin imágenes: las URLs de Imgur que tenían ya no existen (se quitaron el 2026-11-26).
const SEED_POSTS: {
  username: string;
  mii_avatar_url: string;
  content_text: string;
  drawing_url: string | null;
  screenshot_url: string | null;
  game_title: string;
}[] = [
  {
    username: 'ZeldaMaster99',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=ZM&background=2ecc71&color=fff&bold=true&size=64',
    content_text: '¡Por fin terminé Breath of the Wild! La batalla final me costó mucho pero lo logré 💪',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'The Legend of Zelda: Breath of the Wild',
  },
  {
    username: 'SplatoonKing',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=SK&background=e74c3c&color=fff&bold=true&size=64',
    content_text: 'Acabo de llegar al rango S+ en Turf War 🦑🎨 ¡Nadie pare los tentáculos!',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Splatoon 3',
  },
  {
    username: 'MarioMaker2Fan',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=MM&background=e67e22&color=fff&bold=true&size=64',
    content_text: 'Mi nuevo nivel en Super Mario Maker 2 ya está disponible. ¡A ver quién puede terminarlo sin morir!',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Super Mario Maker 2',
  },
  {
    username: 'PikminAdventurer',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=PA&background=27ae60&color=fff&bold=true&size=64',
    content_text: 'Dibujé a mi Pikmin favorito 🌿 El Pikmin roca es demasiado adorable',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Pikmin 4',
  },
  {
    username: 'AnimalCrossingIsla',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=AC&background=f39c12&color=fff&bold=true&size=64',
    content_text: 'Mi isla ya tiene 5 estrellas con Isabelle 🌟 Tantas horas de trabajo valieron la pena',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Animal Crossing: New Horizons',
  },
  {
    username: 'KirbyArtist',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=KA&background=ff69b4&color=fff&bold=true&size=64',
    content_text: '¡Kirby con habilidad de copiar espada es simplemente el más poderoso! 🌟',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Kirby and the Forgotten Land',
  },
  {
    username: 'SmashBrosPro',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=SB&background=9b59b6&color=fff&bold=true&size=64',
    content_text: 'Llevo 300 horas en Smash Ultimate y aún sigo mejorando con Link 🗡️ ¡El juego nunca envejece!',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Super Smash Bros. Ultimate',
  },
  {
    username: 'MetroidHunter',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=MH&background=e74c3c&color=fff&bold=true&size=64',
    content_text: 'Samus en Metroid Dread es BRUTAL. La sensación al esquivar a los EMMI no tiene precio 💀',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Metroid Dread',
  },
  {
    username: 'FoxMcCloud64',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=FC&background=1a252f&color=fff&bold=true&size=64',
    content_text: 'DO A BARREL ROLL! Star Fox 64 sigue sin envejecer 🚀🦊',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Star Fox 64',
  },
  {
    username: 'PokemonTrainer',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=PT&background=e74c3c&color=fff&bold=true&size=64',
    content_text: 'Finalmente entrené mi primer equipo competitivo 6vs6. Lleva semanas pero valió la pena 🏆',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Pokémon Escarlata y Púrpura',
  },
  {
    username: 'NintendoFan_MX',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=NF&background=c0392b&color=fff&bold=true&size=64',
    content_text: 'Pintando al estilo Miiverse es lo más relajante que existe 😌🎨',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Wii U & Switch Community Art',
  },
  {
    username: 'WaluigiTime',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=WT&background=8e44ad&color=fff&bold=true&size=64',
    content_text: 'WALUIGI NUMBER ONE!!! 🎾 El mundo me debe un juego propio',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Mario Tennis Aces',
  },
  {
    username: 'BotWExplorer',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=BE&background=3498db&color=fff&bold=true&size=64',
    content_text: 'Mapa del Santuario más difícil de encontrar completado ✅ ¡El mundo abierto de Zelda es infinito!',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'The Legend of Zelda: Tears of the Kingdom',
  },
  {
    username: 'DonkeyKongFan',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=DK&background=8B4513&color=fff&bold=true&size=64',
    content_text: 'Tropical Freeze sigue siendo el juego de plataformas más difícil que he jugado. Enorme DK 🍌',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Donkey Kong Country: Tropical Freeze',
  },
  {
    username: 'YoshiArtist',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=YA&background=2ecc71&color=fff&bold=true&size=64',
    content_text: '¡Mi dibujo de Yoshi de hoy! Practicando el estilo crayón que tiene el juego 🦎💚',
    drawing_url: null,
    screenshot_url: null,
    game_title: "Yoshi's Crafted World",
  },
  {
    username: 'BayonettaDancer',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=BD&background=2c3e50&color=fff&bold=true&size=64',
    content_text: 'La cámara lenta en los ataques de Bayonetta es una obra de arte en sí misma 🔫💫',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Bayonetta 3',
  },
  {
    username: 'XenobladeChronicles',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=XC&background=e91e63&color=fff&bold=true&size=64',
    content_text: '300 horas de juego y el mundo de Xenoblade Chronicles 3 todavía me sorprende ✨',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Xenoblade Chronicles 3',
  },
  {
    username: 'MarineFishFan',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=MF&background=1abc9c&color=fff&bold=true&size=64',
    content_text: 'Dibujé al equipo de Splatoon con estilo anime ¡Las tintas del juego me inspiran demasiado! 🦑',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Splatoon 3',
  },
  {
    username: 'FireEmblemWarrior',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=FE&background=c0392b&color=fff&bold=true&size=64',
    content_text: 'El sistema de clases en Fire Emblem Engage es adictivo. Mis personajes favoritos acaban de evol. ⚔️',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Fire Emblem Engage',
  },
  {
    username: 'MarioOdysseyRun',
    mii_avatar_url: 'https://ui-avatars.com/api/?name=MO&background=e74c3c&color=fff&bold=true&size=64',
    content_text: '999 lunas recolectadas en Super Mario Odyssey 🌙 Gracias a Cappy por todo 🎩',
    drawing_url: null,
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

    // Top Players semanal: cada Yeah guarda cuándo se dio. A los Yeahs que ya
    // existían se les pone la fecha de esta migración (no se sabe la real).
    await this.db.query(`
      ALTER TABLE miiverse_yeahs
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      CREATE INDEX IF NOT EXISTS idx_miiverse_yeahs_created ON miiverse_yeahs (created_at);
    `);

    // Los posts de ejemplo apuntaban a imágenes de Imgur que ya no existen.
    // Solo toca posts de ejemplo (is_seed) con URLs de Imgur; es idempotente.
    await this.db.query(`
      UPDATE miiverse_posts
         SET drawing_url = CASE WHEN drawing_url LIKE 'https://i.imgur.com/%' THEN NULL ELSE drawing_url END,
             screenshot_url = CASE WHEN screenshot_url LIKE 'https://i.imgur.com/%' THEN NULL ELSE screenshot_url END
       WHERE is_seed = TRUE
         AND (drawing_url LIKE 'https://i.imgur.com/%' OR screenshot_url LIKE 'https://i.imgur.com/%');
    `);

    // Fase 3: spoilers y comentarios. Solo añade; no toca datos existentes.
    await this.db.query(`
      ALTER TABLE miiverse_posts
        ADD COLUMN IF NOT EXISTS is_spoiler BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS miiverse_comments (
        id               SERIAL PRIMARY KEY,
        post_id          INTEGER NOT NULL REFERENCES miiverse_posts(id) ON DELETE CASCADE,
        user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username         VARCHAR(100) NOT NULL,
        mii_avatar_url   TEXT,
        content_text     TEXT NOT NULL,
        is_spoiler       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_miiverse_comments_post
        ON miiverse_comments (post_id, created_at);
      ALTER TABLE miiverse_comments
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
    `);

    // Yeahs de comentarios: una fila por (comentario, usuario). El total se
    // cuenta al leer, así no hay un contador que se pueda desincronizar.
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS miiverse_comment_yeahs (
        comment_id  INTEGER REFERENCES miiverse_comments(id) ON DELETE CASCADE,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (comment_id, user_id)
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
      `SELECT ${POST_COLUMNS} FROM miiverse_posts p ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
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
    const post = cleanPostInput(dto);
    const result = await this.db.query<MiiversePost>(
      `INSERT INTO miiverse_posts
         (user_id, username, mii_avatar_url, content_text, drawing_url, screenshot_url, game_title, is_spoiler, is_seed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE)
       RETURNING *, 0 AS comments_count`,
      [
        userId,
        username,
        avatarUrl,
        post.content_text,
        post.drawing_url,
        post.screenshot_url,
        post.game_title,
        post.is_spoiler,
      ],
    );
    return result[0];
  }

  // ─── Yeah (Me gusta) ───────────────────────────────────────────────────────
  async toggleYeah(postId: number, userId: number): Promise<{ yeahs: number }> {
    await this.getPost(postId); // 404 si el post no existe (antes: error 500 de la BD)

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
      `SELECT ${POST_COLUMNS} FROM miiverse_posts p
        WHERE ${POST_COMMUNITY_KEY} = ${communityKey('$1')} AND ${POST_COMMUNITY_KEY} <> ''
        ORDER BY ${ORDER_BY[query.sort]} LIMIT $2 OFFSET $3`,
      [name, query.limit, (query.page - 1) * query.limit],
    );
    return { ...summary, posts };
  }

  async getPost(id: number): Promise<MiiversePost> {
    const [post] = await this.db.query<MiiversePost>(
      `SELECT ${POST_COLUMNS} FROM miiverse_posts p WHERE id = $1`,
      [id],
    );
    if (!post) throw new NotFoundException('La publicación no existe');
    return post;
  }

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
  async getTopPlayers(weeksAgo: number, timeZone: string): Promise<MiiverseTopPlayers> {
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

  // ─── Comentarios (fase 3) ──────────────────────────────────────────────────

  /**
   * Comentarios de un post, del más antiguo al más nuevo (como Archiverse).
   * `viewerId` es el usuario que mira (null si es invitado) para saber a qué
   * comentarios ya les dio Yeah.
   */
  async getComments(postId: number, viewerId: number | null): Promise<MiiverseComment[]> {
    await this.getPost(postId); // 404 si el post no existe
    return this.db.query<MiiverseComment>(
      `SELECT ${commentColumns('$2::int')} FROM miiverse_comments c
        WHERE post_id = $1
        ORDER BY created_at ASC, id ASC
        LIMIT 200`,
      [postId, viewerId],
    );
  }

  private async getComment(id: number, viewerId: number | null): Promise<MiiverseComment> {
    const [comment] = await this.db.query<MiiverseComment>(
      `SELECT ${commentColumns('$2::int')} FROM miiverse_comments c WHERE id = $1`,
      [id, viewerId],
    );
    if (!comment) throw new NotFoundException('El comentario no existe');
    return comment;
  }

  /** Devuelve el comentario si `userId` es su autor; si no, 404 o 403. */
  private async getOwnComment(id: number, userId: number): Promise<MiiverseComment> {
    const comment = await this.getComment(id, userId);
    if (comment.user_id !== userId) {
      throw new ForbiddenException('Solo el autor puede modificar este comentario');
    }
    return comment;
  }

  async createComment(
    postId: number,
    dto: CreateCommentDto,
    userId: number,
    username: string,
    avatarUrl: string,
  ): Promise<MiiverseComment> {
    const text = cleanCommentText(dto?.content_text);
    await this.getPost(postId); // 404 si el post no existe

    const [{ id }] = await this.db.query<{ id: number }>(
      `INSERT INTO miiverse_comments
         (post_id, user_id, username, mii_avatar_url, content_text, is_spoiler)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [postId, userId, username, avatarUrl, text, dto.is_spoiler === true],
    );
    return this.getComment(id, userId);
  }

  /** Editar texto y/o spoiler. Solo el autor. Marca `updated_at`. */
  async updateComment(id: number, dto: UpdateCommentDto, userId: number): Promise<MiiverseComment> {
    const text = cleanCommentText(dto?.content_text);
    const current = await this.getOwnComment(id, userId);
    const isSpoiler = typeof dto.is_spoiler === 'boolean' ? dto.is_spoiler : current.is_spoiler;

    await this.db.query(
      `UPDATE miiverse_comments
          SET content_text = $2, is_spoiler = $3, updated_at = NOW()
        WHERE id = $1`,
      [id, text, isSpoiler],
    );
    return this.getComment(id, userId);
  }

  /**
   * Borrar un comentario: puede su autor o un administrador (moderación).
   * Sus Yeahs se borran en cascada.
   */
  async deleteComment(id: number, userId: number, isAdmin: boolean): Promise<{ id: number; post_id: number }> {
    const comment = isAdmin ? await this.getComment(id, userId) : await this.getOwnComment(id, userId);
    await this.db.query(`DELETE FROM miiverse_comments WHERE id = $1`, [id]);
    return { id, post_id: comment.post_id };
  }

  /**
   * Moderación (solo admin): posts y comentarios juntos, del más nuevo al más
   * viejo, con filtros. Cada fila trae `total` (resultados de la búsqueda
   * completa, no solo de esta página). Día, mes y hora se calculan en la zona
   * horaria del moderador para que coincidan con lo que ve en pantalla.
   */
  async getModerationItems(f: ModerationFilters, page: PageQuery): Promise<MiiverseModerationItem[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    // La zona horaria solo se añade como parámetro si algún filtro de fecha la
    // usa (PostgreSQL rechaza parámetros que la consulta no usa).
    let tzParam: string | undefined;
    const local = () => `(i.created_at AT TIME ZONE ${(tzParam ??= add(f.timeZone))}::text)`;

    if (f.kind !== 'all') where.push(`i.kind = ${add(f.kind)}`);
    if (f.text) where.push(`i.content_text ILIKE '%' || ${add(f.text)} || '%'`);
    if (f.username) where.push(`i.username ILIKE '%' || ${add(f.username)} || '%'`);
    if (f.community) where.push(`${communityKey('i.game_title')} = ${communityKey(add(f.community) + '::text')}`);
    if (f.date) where.push(`${local()}::date = ${add(f.date)}::date`);
    if (f.month) where.push(`to_char(${local()}, 'YYYY-MM') = ${add(f.month)}`);
    if (f.hour !== undefined) where.push(`EXTRACT(HOUR FROM ${local()}) = ${add(f.hour)}`);

    const limit = add(page.limit);
    const offset = add((page.page - 1) * page.limit);

    return this.db.query<MiiverseModerationItem>(
      `SELECT i.*, COUNT(*) OVER()::int AS total
         FROM (
           SELECT 'post' AS kind, p.id, p.id AS post_id, p.username, p.mii_avatar_url,
                  p.content_text, p.drawing_url, p.screenshot_url, p.game_title,
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

  /**
   * Borrar un post (solo admin, moderación). Sus Yeahs, comentarios y los
   * Yeahs de esos comentarios se borran en cascada (claves foráneas).
   */
  async deletePost(id: number): Promise<{ id: number; comments_deleted: number }> {
    const post = await this.getPost(id); // 404 si no existe
    await this.db.query(`DELETE FROM miiverse_posts WHERE id = $1`, [id]);
    return { id, comments_deleted: post.comments_count };
  }

  /**
   * Dar o quitar Yeah a un comentario. Cada consulta es atómica: si ya existía
   * el Yeah, el DELETE lo quita; si no, el INSERT lo crea.
   */
  async toggleCommentYeah(id: number, userId: number): Promise<{ yeahs: number; yeahed: boolean }> {
    await this.getComment(id, userId); // 404 si no existe

    const removed = await this.db.query(
      `DELETE FROM miiverse_comment_yeahs WHERE comment_id = $1 AND user_id = $2 RETURNING 1`,
      [id, userId],
    );
    if (removed.length === 0) {
      await this.db.query(
        `INSERT INTO miiverse_comment_yeahs (comment_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, userId],
      );
    }

    const { yeahs, yeahed } = await this.getComment(id, userId);
    return { yeahs, yeahed };
  }
}
