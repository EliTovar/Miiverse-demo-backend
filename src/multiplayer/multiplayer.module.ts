/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
// import { JwtModule } from '@nestjs/jwt';
import { MultiplayerGateway } from './multiplayer.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { AIModule } from 'src/ai/ai.module';

@Module({
    imports: [AuthModule, AIModule], //JwtModule y IA
    providers: [MultiplayerGateway],
})
export class MultiplayerModule {}
