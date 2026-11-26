import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Role } from '../../auth/constants/roles.enum';

/** Usuario tal como lo ve el panel de administración (nunca incluye la contraseña). */
export interface AdminUserRow {
  id: number;
  username: string;
  email: string;
  role: Role;
  created_at: Date | null;
  posts_count: number;
  comments_count: number;
  total: number; // usuarios que cumplen la búsqueda (no solo esta página)
}

export interface AdminStats {
  users: number;
  admins: number;
  posts: number;
  comments: number;
  new_users_7d: number;
  posts_7d: number;
  comments_7d: number;
}

/**
 * Consultas del panel de administración. Las rutas que lo usan exigen rol
 * admin (ver AdminController); aquí solo hay lógica de datos y validación.
 */
@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  /** Cifras generales de la red social. */
  async getStats(): Promise<AdminStats> {
    const [stats] = await this.db.query<AdminStats>(`
      SELECT
        (SELECT COUNT(*)::int FROM users)                                   AS users,
        (SELECT COUNT(*)::int FROM users WHERE role = 'admin')              AS admins,
        (SELECT COUNT(*)::int FROM miiverse_posts)                          AS posts,
        (SELECT COUNT(*)::int FROM miiverse_comments)                       AS comments,
        (SELECT COUNT(*)::int FROM users
          WHERE created_at >= NOW() - INTERVAL '7 days')                    AS new_users_7d,
        (SELECT COUNT(*)::int FROM miiverse_posts
          WHERE created_at >= NOW() - INTERVAL '7 days')                    AS posts_7d,
        (SELECT COUNT(*)::int FROM miiverse_comments
          WHERE created_at >= NOW() - INTERVAL '7 days')                    AS comments_7d
    `);
    return stats;
  }

  /** Usuarios registrados, del más nuevo al más viejo. `search` busca en nombre o email. */
  async listUsers(search: string | undefined, page: number, limit: number): Promise<AdminUserRow[]> {
    const term = search?.trim();
    return this.db.query<AdminUserRow>(
      `SELECT u.id, u.username, u.email, u.role, u.created_at,
              (SELECT COUNT(*)::int FROM miiverse_posts p WHERE p.user_id = u.id)    AS posts_count,
              (SELECT COUNT(*)::int FROM miiverse_comments c WHERE c.user_id = u.id) AS comments_count,
              COUNT(*) OVER()::int AS total
         FROM users u
        WHERE $1::text IS NULL OR u.username ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%'
        ORDER BY u.id DESC
        LIMIT $2 OFFSET $3`,
      [term ? term : null, limit, (page - 1) * limit],
    );
  }

  /**
   * Cambia el rol de un usuario. Un admin no puede cambiar su propio rol: así
   * nadie se quita el acceso por error y siempre queda al menos un admin.
   * El cambio se aplica cuando el usuario vuelve a iniciar sesión (el rol va
   * dentro del token, que dura 1 h).
   */
  async setRole(targetId: number, role: unknown, actingAdminId: number): Promise<{ id: number; role: Role }> {
    if (role !== Role.USER && role !== Role.ADMIN) {
      throw new BadRequestException(`role debe ser "${Role.USER}" o "${Role.ADMIN}"`);
    }
    if (targetId === actingAdminId) {
      throw new BadRequestException('No puedes cambiar tu propio rol');
    }
    const [updated] = await this.db.query<{ id: number; role: Role }>(
      `UPDATE users SET role = $2 WHERE id = $1 RETURNING id, role`,
      [targetId, role],
    );
    if (!updated) throw new NotFoundException('El usuario no existe');
    return updated;
  }
}
