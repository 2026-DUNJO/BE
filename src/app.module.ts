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
import { MatchingModule } from './matching/matching.module.js';
import { LocationModule } from './location/location.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { FriendshipsModule } from './friendships/friendships.module.js';
import { ChatModule } from './chat/chat.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    SpotifyModule,
    LastfmModule,
    MusicModule,
    GroqModule,
    MatchingModule,
    LocationModule,
    InvitationsModule,
    FriendshipsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}