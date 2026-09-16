import { Module } from '@nestjs/common';

import { LastfmModule } from '../lastfm/lastfm.module.js';

import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [
    LastfmModule,
  ],

  controllers: [
    MatchingController,
  ],

  providers: [
    MatchingService,
  ],

  exports: [
    MatchingService,
  ],
})
export class MatchingModule {}