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
import { PostsService } from './posts.service';
import { CommentsService } from './comments.service';
import { CommunitiesService } from './communities.service';
import { ProfilesService } from './profiles.service';
import { ModerationService } from './moderation.service';
import { avatarFor, toModerationFilters, toPageQuery, toTimeZone } from './miiverse-query.parsers';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto';
import { CurrentUser } from '../auth/decorator/current.decorator';
import { AuthRequiredGuard } from '../auth/guards/auth-required.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import type { AuthUser } from '../auth/interfaces/auth.user.interface';
import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';


@Controller('miiverse')
export class MiiverseController {
  private readonly logger = new Logger(MiiverseController.name);

  constructor(
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
    private readonly communities: CommunitiesService,
    private readonly profiles: ProfilesService,
    private readonly moderation: ModerationService,
  ) {}

  /** Feed público – accessible por cualquier visitante (incluso sin JWT) */
  @Get('feed')
  getFeed(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.posts.getFeed(+page, +limit);
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

    return this.posts.createPost(dto, user.id, user.username, avatarFor(user.username));
  }

  /** Toggle Yeah en un post – requiere estar autenticado */
  @Post('posts/:id/yeah')
  @UseGuards(AuthRequiredGuard)
  toggleYeah(
    @Param('id', ParseIntPipe) postId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.posts.toggleYeah(postId, user.id);
  }

  // ─── Lectura estilo Archiverse (públicas, sin JWT) ─────────────────────────

  /** Lista de comunidades (a partir de game_title). `q` filtra por nombre. */
  @Get('communities')
  getCommunities(@Query('q') q?: string) {
    return this.communities.getCommunities(q);
  }

  /** Resumen de una comunidad + una página de sus posts. */
  @Get('communities/:name')
  getCommunity(
    @Param('name') name: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.communities.getCommunity(name, toPageQuery(page, limit, sort));
  }

  /** Un post concreto. */
  @Get('posts/:id')
  getPost(@Param('id', ParseIntPipe) id: number) {
    return this.posts.getPost(id);
  }

  /** Buscar usuarios por nombre (`q`). Sin `q`, los más activos. */
  @Get('users')
  searchUsers(@Query('q') q?: string) {
    return this.profiles.searchUsers(q);
  }

  /**
   * Top Players: los 5 usuarios con más Yeahs recibidos en la semana (lunes a
   * domingo en la zona `tz`). `weeksAgo` = 0 semana actual, 1 la anterior…
   */
  @Get('top-players')
  getTopPlayers(@Query('weeksAgo') weeksAgo?: string, @Query('tz') tz?: string) {
    const weeks = weeksAgo === undefined || weeksAgo === '' ? 0 : Number(weeksAgo);
    if (!Number.isInteger(weeks) || weeks < 0 || weeks > 520) {
      throw new BadRequestException('weeksAgo debe ser un número entero de 0 a 520');
    }
    return this.profiles.getTopPlayers(weeks, toTimeZone(tz));
  }

  /** Comentarios de un post (públicos). Con sesión, indica a cuáles ya diste Yeah. */
  @Get('posts/:id/comments')
  getComments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.comments.getComments(id, user?.id ?? null);
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
    return this.comments.createComment(id, dto, user.id, user.username, avatarFor(user.username));
  }

  /** Editar un comentario – solo su autor (403 si no lo es). */
  @Patch('comments/:id')
  @UseGuards(AuthRequiredGuard)
  updateComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.updateComment(id, dto, user.id);
  }

  /** Borrar un comentario – su autor o un administrador (403 si no). */
  @Delete('comments/:id')
  @UseGuards(AuthRequiredGuard)
  deleteComment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.deleteComment(id, user.id, user.role === Role.ADMIN);
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
    return this.moderation.getModerationItems(
      toModerationFilters(query),
      toPageQuery(query.page, query.limit),
    );
  }

  /** Borrar un post – solo admin (moderación). Borra también sus comentarios. */
  @Delete('posts/:id')
  @UseGuards(AuthRequiredGuard)
  @Roles(Role.ADMIN)
  deletePost(@Param('id', ParseIntPipe) id: number) {
    return this.posts.deletePost(id);
  }

  /** Dar o quitar Yeah a un comentario – requiere sesión. */
  @Post('comments/:id/yeah')
  @UseGuards(AuthRequiredGuard)
  toggleCommentYeah(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.toggleCommentYeah(id, user.id);
  }

  /** Perfil público de un usuario + una página de sus posts. */
  @Get('users/:username')
  getUserProfile(
    @Param('username') username: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.profiles.getUserProfile(username, toPageQuery(page, limit, sort));
  }
}
