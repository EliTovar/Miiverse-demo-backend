import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePostDto } from './dto/create-post.dto';
import { MiiversePost } from './miiverse-post.entity';
import { POST_COLUMNS } from './miiverse-sql';

/** Largo máximo del texto de un post (el compositor del frontend usa el mismo). */
const MAX_POST_LENGTH = 500;
/** Largo máximo del nombre de comunidad (columna VARCHAR(200)). */
const MAX_GAME_TITLE_LENGTH = 200;
/** Las imágenes de un post son siempre data URL PNG/JPEG generadas en el navegador. */
const IMAGE_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

/**
 * Valida y limpia lo que llega al publicar. Antes solo lo comprobaba el
 * frontend, así que una petición hecha a mano podía saltarse los límites.
 */
function cleanPostInput(dto: CreatePostDto | undefined) {
  const optionalText = (
    value: unknown,
    field: string,
    max: number,
  ): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string')
      throw new BadRequestException(`${field} debe ser texto`);
    const text = value.trim();
    if (text.length > max)
      throw new BadRequestException(
        `${field} no puede pasar de ${max} caracteres`,
      );
    return text || null;
  };
  const optionalImage = (value: unknown, field: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !IMAGE_DATA_URL.test(value)) {
      throw new BadRequestException(
        `${field} debe ser una imagen PNG o JPEG generada en la app`,
      );
    }
    return value;
  };

  const content_text = optionalText(
    dto?.content_text,
    'El texto',
    MAX_POST_LENGTH,
  );
  const drawing_url = optionalImage(dto?.drawing_url, 'El dibujo');
  const screenshot_url = optionalImage(dto?.screenshot_url, 'La captura');
  const game_title = optionalText(
    dto?.game_title,
    'La comunidad',
    MAX_GAME_TITLE_LENGTH,
  );
  if (!content_text && !drawing_url && !screenshot_url) {
    throw new BadRequestException('La publicación necesita texto o un dibujo');
  }
  return {
    content_text,
    drawing_url,
    screenshot_url,
    game_title,
    is_spoiler: dto?.is_spoiler === true,
  };
}

/** Publicaciones: feed, publicar, leer, Yeah y borrar (moderación). */
@Injectable()
export class PostsService {
  constructor(private readonly db: DatabaseService) {}

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

  async getPost(id: number): Promise<MiiversePost> {
    const [post] = await this.db.query<MiiversePost>(
      `SELECT ${POST_COLUMNS} FROM miiverse_posts p WHERE id = $1`,
      [id],
    );
    if (!post) throw new NotFoundException('La publicación no existe');
    return post;
  }

  /**
   * Borrar un post (solo admin, moderación). Sus Yeahs, comentarios y los
   * Yeahs de esos comentarios se borran en cascada (claves foráneas).
   */
  async deletePost(
    id: number,
  ): Promise<{ id: number; comments_deleted: number }> {
    const post = await this.getPost(id); // 404 si no existe
    await this.db.query(`DELETE FROM miiverse_posts WHERE id = $1`, [id]);
    return { id, comments_deleted: post.comments_count };
  }
}
