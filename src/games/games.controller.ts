import { Controller, Get, SetMetadata, Query, Res } from '@nestjs/common';
import { GamesService } from './games.service';
import * as express from 'express';

export const Public = () => SetMetadata('isPublic', true);

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Public() // Permitir que cualquiera vea las tendencias
  @Get('trending')
  async getTrending() {
    return this.gamesService.getTrendingGames();
  }

  @Public()
  @Get('recent')
  async getRecent() {
    return this.gamesService.getRecentGames();
  }

  @Public()
  @Get('proxy')
  async proxyImage(@Query('url') url: string, @Res() res: express.Response) {
    try {
      const { buffer, contentType } = await this.gamesService.fetchImage(url);
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (e) {
      res.status(404).send('Not Found');
    }
  }
}
