import { Controller, Get, SetMetadata } from '@nestjs/common';
import { DiscordService } from './discord.service';

export const Public = () => SetMetadata('isPublic', true);

@Controller('discord')
export class DiscordController {
  constructor(private readonly discordService: DiscordService) {}

  @Public()
  @Get('top-bots')
  async getTopBots() {
    return this.discordService.getTopBots();
  }

  @Public()
  @Get('trending-bots')
  async getTrendingBots() {
    return this.discordService.getTrendingBots();
  }
}
