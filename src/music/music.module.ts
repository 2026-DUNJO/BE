import { Module } from '@nestjs/common';

import { SpotifyModule } from '../spotify/spotify.module.js';
import { LastfmModule } from '../lastfm/lastfm.module.js';

import { MusicController } from './music.controller.js';
import { MusicService } from './music.service.js';

@Module({
  imports: [
    SpotifyModule,
    LastfmModule,
  ],
  controllers: [MusicController],
  providers: [MusicService],
})
export class MusicModule {}