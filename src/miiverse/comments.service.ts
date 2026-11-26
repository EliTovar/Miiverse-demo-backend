import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto';
import { MiiverseComment } from './miiverse-post.entity';
import { PostsService } from './posts.service';

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

/** Valida y limpia el texto de un comentario (crear y editar). */
function cleanCommentText(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text)
    throw new BadRequestException('El comentario no puede estar vacío');
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new BadRequestException(
      `El comentario no puede pasar de ${MAX_COMMENT_LENGTH} caracteres`,
    );
  }
  return text;
}

/** Comentarios de los posts y sus Yeahs. */
@Injectable()
export class CommentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly posts: PostsService,
  ) {}

  /**
   * Comentarios de un post, del más antiguo al más nuevo (como Archiverse).
   * `viewerId` es el usuario que mira (null si es invitado) para saber a qué
   * comentarios ya les dio Yeah.
   */
  async getComments(
    postId: number,
    viewerId: number | null,
  ): Promise<MiiverseComment[]> {
    await this.posts.getPost(postId); // 404 si el post no existe
    return this.db.query<MiiverseComment>(
      `SELECT ${commentColumns('$2::int')} FROM miiverse_comments c
        WHERE post_id = $1
        ORDER BY created_at ASC, id ASC
        LIMIT 200`,
      [postId, viewerId],
    );
  }

  private async getComment(
    id: number,
    viewerId: number | null,
  ): Promise<MiiverseComment> {
    const [comment] = await this.db.query<MiiverseComment>(
      `SELECT ${commentColumns('$2::int')} FROM miiverse_comments c WHERE id = $1`,
      [id, viewerId],
    );
    if (!comment) throw new NotFoundException('El comentario no existe');
    return comment;
  }

  /** Devuelve el comentario si `userId` es su autor; si no, 404 o 403. */
  private async getOwnComment(
    id: number,
    userId: number,
  ): Promise<MiiverseComment> {
    const comment = await this.getComment(id, userId);
    if (comment.user_id !== userId) {
      throw new ForbiddenException(
        'Solo el autor puede modificar este comentario',
      );
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
    await this.posts.getPost(postId); // 404 si el post no existe

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
  async updateComment(
    id: number,
    dto: UpdateCommentDto,
    userId: number,
  ): Promise<MiiverseComment> {
    const text = cleanCommentText(dto?.content_text);
    const current = await this.getOwnComment(id, userId);
    const isSpoiler =
      typeof dto.is_spoiler === 'boolean' ? dto.is_spoiler : current.is_spoiler;

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
  async deleteComment(
    id: number,
    userId: number,
    isAdmin: boolean,
  ): Promise<{ id: number; post_id: number }> {
    const comment = isAdmin
      ? await this.getComment(id, userId)
      : await this.getOwnComment(id, userId);
    await this.db.query(`DELETE FROM miiverse_comments WHERE id = $1`, [id]);
    return { id, post_id: comment.post_id };
  }

  /**
   * Dar o quitar Yeah a un comentario. Cada consulta es atómica: si ya existía
   * el Yeah, el DELETE lo quita; si no, el INSERT lo crea.
   */
  async toggleCommentYeah(
    id: number,
    userId: number,
  ): Promise<{ yeahs: number; yeahed: boolean }> {
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
