import { Module } from '@nestjs/common';

import { SpotifyController } from './spotify.controller.js';
import { SpotifyService } from './spotify.service.js';

@Module({
  controllers: [SpotifyController],
  providers: [SpotifyService],

  // 다른 Module에서도 SpotifyService 사용 가능
  exports: [SpotifyService],
})
export class SpotifyModule {}