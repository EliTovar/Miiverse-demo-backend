import { Controller, Get, Query, Res } from '@nestjs/common';
import { GamesService } from './games.service';
import * as express from 'express';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get('trending')
  async getTrending() {
    return this.gamesService.getTrendingGames();
  }

  @Get('recent')
  async getRecent() {
    return this.gamesService.getRecentGames();
  }

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
