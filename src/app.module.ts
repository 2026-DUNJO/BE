import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { SpotifyModule } from './spotify/spotify.module.js';
import { LastfmModule } from './lastfm/lastfm.module.js';
import { MusicModule } from './music/music.module.js';
import { GroqModule } from './groq/groq.module.js';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, SpotifyModule, LastfmModule, MusicModule, GroqModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}