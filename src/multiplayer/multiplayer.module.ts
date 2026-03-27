/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
// import { JwtModule } from '@nestjs/jwt';
import { MultiplayerGateway } from './multiplayer.gateway';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports:[AuthModule], //JwtModule
    providers: [MultiplayerGateway],
})
export class MultiplayerModule {}
