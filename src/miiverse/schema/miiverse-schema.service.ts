import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SEED_POSTS } from './seed-posts';

/**
 * Al arrancar crea (o actualiza) las tablas de Miiverse e inserta los posts
 * de ejemplo si todavía no existen. Todo es idempotente: se puede ejecutar
 * en cada arranque sin duplicar nada.
 */
@Injectable()
export class MiiverseSchemaService implements OnModuleInit {
  private readonly logger = new Logger(MiiverseSchemaService.name);

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
    this.logger.log(
      `✅ ${SEED_POSTS.length} seed posts insertados en Miiverse`,
    );
  }
}
