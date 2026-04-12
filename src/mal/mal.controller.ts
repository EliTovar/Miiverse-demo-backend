import { Controller, Get } from '@nestjs/common';
import { MalService } from './mal.service';

@Controller('mal')
export class MalController {
  constructor(private readonly malService: MalService) {}

  @Get('anime')
  getTopAnime() {
    return this.malService.getTopAnime();
  }

  @Get('manga')
  getTopManga() {
    return this.malService.getTopManga();
  }
}
