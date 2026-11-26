/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
// import { JwtModule } from '@nestjs/jwt';
import { MultiplayerGateway } from './multiplayer.gateway';
import { AuthModule } from '../auth/auth.module';
import { AIModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [AuthModule, UsersModule, AIModule], //JwtModule, Users y IA
    providers: [MultiplayerGateway],
})
export class MultiplayerModule {}
