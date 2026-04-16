import { Module } from '@nestjs/common';
import { MiiverseController } from './miiverse.controller';
import { MiiverseService } from './miiverse.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MiiverseController],
  providers: [MiiverseService],
})
export class MiiverseModule {}
