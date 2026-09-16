import { Module } from '@nestjs/common';

import { GroqModule } from '../groq/groq.module.js';
import { LastfmModule } from '../lastfm/lastfm.module.js';
import { LocationModule } from '../location/location.module.js';
import { SpotifyModule } from '../spotify/spotify.module.js';

import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [
    GroqModule,
    LastfmModule,
    LocationModule,
    SpotifyModule,
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