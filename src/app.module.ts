/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { MultiplayerModule } from './multiplayer/multiplayer.module';
import { ConfigModule } from '@nestjs/config';
import { GamesModule } from './games/games.module';
import { DiscordModule } from './discord/discord.module';
import { SpotifyModule } from './spotify/spotify.module';
import { MalModule } from './mal/mal.module';
import { PixivModule } from './pixiv/pixiv.module';
import { MiiverseModule } from './miiverse/miiverse.module';


@Module({
  imports: [ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule, UsersModule, AuthModule, AuthModule, MultiplayerModule, GamesModule, DiscordModule, SpotifyModule, MalModule, PixivModule, MiiverseModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },],
})
export class AppModule {}
