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
import { MiiverseService } from './miiverse.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CurrentUser } from '../auth/decorator/current.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Logger, UnauthorizedException } from '@nestjs/common';

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
  @UseGuards(JwtAuthGuard)
  createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: any,
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
  @UseGuards(JwtAuthGuard)
  toggleYeah(
    @Param('id', ParseIntPipe) postId: number,
    @CurrentUser() user: any,
  ) {
    return this.miiverseService.toggleYeah(postId, user.id);
  }
}
