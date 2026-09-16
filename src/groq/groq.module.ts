import { Module } from '@nestjs/common';

import { GroqService } from './groq.service.js';

@Module({
  providers: [GroqService],
  exports: [GroqService],
})
export class GroqModule {}