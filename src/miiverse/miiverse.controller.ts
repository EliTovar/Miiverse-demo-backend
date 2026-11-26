import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MiiverseService, ModerationFilters, PageQuery } from './miiverse.service';
import { PostSort } from './miiverse-post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto';
import { CurrentUser } from '../auth/decorator/current.decorator';
import { AuthRequiredGuard } from '../auth/guards/auth-required.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import type { AuthUser } from '../auth/interfaces/auth.user.interface';
import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';

const SORTS: PostSort[] = ['recent', 'oldest', 'popular'];

/**
 * Valida los filtros de moderación de la URL. Responde 400 si alguno tiene un
 * formato incorrecto, en vez de ignorarlo en silencio.
 */
function toModerationFilters(q: Record<string, string | undefined>): ModerationFilters {
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined);

  const kind = q.type ?? 'all';
  if (!['all', 'post', 'comment'].includes(kind)) {
    throw new BadRequestException('type debe ser all, post o comment');
  }

  const timeZone = q.tz ?? 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone }); // lanza RangeError si la zona no existe
  } catch {
    throw new BadRequestException('Zona horaria no válida');
  }

  const date = clean(q.date);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) {
    throw new BadRequestException('date debe tener el formato AAAA-MM-DD');
  }
  const month = clean(q.month);
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new BadRequestException('month debe tener el formato AAAA-MM');
  }
  let hour: number | undefined;
  if (clean(q.hour) !== undefined) {
    hour = Number(q.hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new BadRequestException('hour debe ser un número de 0 a 23');
    }
  }

  return {
    kind: kind as ModerationFilters['kind'],
    text: clean(q.q),
    username: clean(q.user),
    community: clean(q.community),
    timeZone,
    date,
    month,
    hour,
  };
}

/** Avatar generado a partir del nombre (lo usan posts y comentarios). */
function avatarFor(username: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0070f3&color=fff&bold=true&size=64`;
}

/**
 * Convierte los parámetros de la URL en una paginación segura: página >= 1,
 * límite entre 1 y 50 y un orden de la lista permitida (si no, 'recent').
 */
function toPageQuery(page?: string, limit?: string, sort?: string): PageQuery {
  const pageNum = Math.max(1, Math.floor(Number(page)) || 1);
  const limitNum = Math.min(50, Math.max(1, Math.floor(Number(limit)) || 20));
  const sortValue = SORTS.includes(sort as PostSort) ? (sort as PostSort) : 'recent';
  return { page: pageNum, limit: limitNum, sort: sortValue };
}

@Controller('miiverse')
export class MiiverseController {
  private readonly logger = new Logger(MiiverseController.name);

  constructor(private readonly miiverseService: MiiverseService) {}

  /** Feed público – accessible por cualquier visitante (incluso sin JWT) */
  @Get('feed')
  getFeed(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.miiverseService.getFeed(+page, +limit);
  }

  /** Publicar un post – requiere estar autenticado */
  @Post('posts')
  @UseGuards(AuthRequiredGuard)
  createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user || !user.id || !user.username) {
      this.logger.error('❌ Intento de publicación sin usuario válido:', user);
      throw new UnauthorizedException('Debe iniciar sesión para publicar');
    }

    return this.miiverseService.createPost(dto, user.id, user.username, avatarFor(user.username));
  }

  /** Toggle Yeah en un post – requiere estar autenticado */
  @Post('posts/:id/yeah')
  @UseGuards(AuthRequiredGuard)
  toggleYeah(
    @Param('id', ParseIntPipe) postId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.miiverseService.toggleYeah(postId, user.id);
  }

  // ─── Lectura estilo Archiverse (públicas, sin JWT) ─────────────────────────

  /** Lista de comunidades (a partir de game_title). `q` filtra por nombre. */
  @Get('communities')
  getCommunities(@Query('q') q?: string) {
    return this.miiverseService.getCommunities(q);
  }

  /** Resumen de una comunidad + una página de sus posts. */
  @Get('communities/:name')
  getCommunity(
    @Param('name') name: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.miiverseService.getCommunity(name, toPageQuery(page, limit, sort));
  }

  /** Un post concreto. */
  @Get('posts/:id')
  getPost(@Param('id', ParseIntPipe) id: number) {
    return this.miiverseService.getPost(id);
  }

  /** Buscar usuarios por nombre (`q`). Sin `q`, los más activos. */
  @Get('users')
  searchUsers(@Query('q') q?: string) {
    return this.miiverseService.searchUsers(q);
  }

  /** Comentarios de un post (públicos). Con sesión, indica a cuáles ya diste Yeah. */
  @Get('posts/:id/comments')
  getComments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.miiverseService.getComments(id, user?.id ?? null);
  }

  /** Comentar un post – requiere estar autenticado. */
  @Post('posts/:id/comments')
  @UseGuards(AuthRequiredGuard)
  createComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user?.id || !user.username) {
      throw new UnauthorizedException('Debe iniciar sesión para comentar');
    }
    return this.miiverseService.createComment(id, dto, user.id, user.username, avatarFor(user.username));
  }

  /** Editar un comentario – solo su autor (403 si no lo es). */
  @Patch('comments/:id')
  @UseGuards(AuthRequiredGuard)
  updateComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.miiverseService.updateComment(id, dto, user.id);
  }

  /** Borrar un comentario – su autor o un administrador (403 si no). */
  @Delete('comments/:id')
  @UseGuards(AuthRequiredGuard)
  deleteComment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.miiverseService.deleteComment(id, user.id, user.role === Role.ADMIN);
  }

  /**
   * Moderación: posts y comentarios con filtros. Solo admin: AuthRequiredGuard
   * exige sesión (401) y @Roles lo comprueba el RolesGuard global (403).
   * Parámetros: type=all|post|comment, q, user, community, date=AAAA-MM-DD,
   * month=AAAA-MM, hour=0-23, tz=zona IANA, page, limit.
   */
  @Get('admin/items')
  @UseGuards(AuthRequiredGuard)
  @Roles(Role.ADMIN)
  getModerationItems(@Query() query: Record<string, string | undefined>) {
    return this.miiverseService.getModerationItems(
      toModerationFilters(query),
      toPageQuery(query.page, query.limit),
    );
  }

  /** Borrar un post – solo admin (moderación). Borra también sus comentarios. */
  @Delete('posts/:id')
  @UseGuards(AuthRequiredGuard)
  @Roles(Role.ADMIN)
  deletePost(@Param('id', ParseIntPipe) id: number) {
    return this.miiverseService.deletePost(id);
  }

  /** Dar o quitar Yeah a un comentario – requiere sesión. */
  @Post('comments/:id/yeah')
  @UseGuards(AuthRequiredGuard)
  toggleCommentYeah(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.miiverseService.toggleCommentYeah(id, user.id);
  }

  /** Perfil público de un usuario + una página de sus posts. */
  @Get('users/:username')
  getUserProfile(
    @Param('username') username: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.miiverseService.getUserProfile(username, toPageQuery(page, limit, sort));
  }
}
