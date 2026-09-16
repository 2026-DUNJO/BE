import { Module } from '@nestjs/common';

import { SpotifyController } from './spotify.controller.js';
import { SpotifyService } from './spotify.service.js';

@Module({
  controllers: [SpotifyController],
  providers: [SpotifyService],
})
export class SpotifyModule {}