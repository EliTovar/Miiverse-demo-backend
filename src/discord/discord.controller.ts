import { Controller, Get } from '@nestjs/common';
import { DiscordService } from './discord.service';

@Controller('discord')
export class DiscordController {
  constructor(private readonly discordService: DiscordService) {}

  @Get('top-bots')
  async getTopBots() {
    return this.discordService.getTopBots();
  }

  @Get('trending-bots')
  async getTrendingBots() {
    return this.discordService.getTrendingBots();
  }
}
