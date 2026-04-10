/* eslint-disable prettier/prettier */
// ai.module.ts
import { Module } from '@nestjs/common';
import { AIService } from './ai.service';

@Module({
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}