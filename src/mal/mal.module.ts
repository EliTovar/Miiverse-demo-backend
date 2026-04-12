import { Module } from '@nestjs/common';
import { MalController } from './mal.controller';
import { MalService } from './mal.service';

@Module({
  controllers: [MalController],
  providers: [MalService],
  exports: [MalService],
})
export class MalModule {}
