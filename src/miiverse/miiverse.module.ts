import { Module } from '@nestjs/common';
import { MiiverseController } from './miiverse.controller';
import { MiiverseService } from './miiverse.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [MiiverseController],
  providers: [MiiverseService],
})
export class MiiverseModule {}
