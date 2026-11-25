import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MiiverseService, PageQuery } from './miiverse.service';
import { PostSort } from './miiverse-post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { CurrentUser } from '../auth/decorator/current.decorator';
import { AuthRequiredGuard } from '../auth/guards/auth-required.guard';
import type { AuthUser } from '../auth/interfaces/auth.user.interface';
import { Logger, UnauthorizedException } from '@nestjs/common';

const SORTS: PostSort[] = ['recent', 'oldest', 'popular'];

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

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=0070f3&color=fff&bold=true&size=64`;
    return this.miiverseService.createPost(dto, user.id, user.username, avatarUrl);
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
