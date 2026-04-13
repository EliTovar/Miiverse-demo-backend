import { Module } from '@nestjs/common';
import { MiiverseController } from './miiverse.controller';
import { MiiverseService } from './miiverse.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MiiverseController],
  providers: [MiiverseService],
})
export class MiiverseModule {}
