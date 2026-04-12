import { Controller, Get } from '@nestjs/common';
import { PixivService } from './pixiv.service';

@Controller('pixiv')
export class PixivController {
  constructor(private readonly pixivService: PixivService) {}

  @Get('daily')
  getDaily() {
    return this.pixivService.getDailyRanking();
  }
}
