import { Controller, Get, SetMetadata } from '@nestjs/common';
import { GamesService } from './games.service';

export const Public = () => SetMetadata('isPublic', true);

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Public() // Permitir que cualquiera vea las tendencias
  @Get('trending')
  async getTrending() {
    return this.gamesService.getTrendingGames();
  }
}
