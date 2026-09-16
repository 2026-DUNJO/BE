import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard.js';

import { SpotifyService } from './spotify.service.js';

@Controller('spotify')
export class SpotifyController {
  constructor(
    private readonly spotifyService: SpotifyService,
  ) {}

  // Spotify 로그인
  @UseGuards(AuthGuard)
  @Get('login')
  login(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.spotifyService.createLoginUrl(
      request.user.sub,
    );
  }

  // Spotify OAuth Callback
  @Get('callback')
  callback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    return this.spotifyService.handleCallback(
      code,
      state,
    );
  }

  // 현재 재생 중인 곡
  @UseGuards(AuthGuard)
  @Get('current-track')
  getCurrentTrack(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.spotifyService.getCurrentTrack(
      request.user.sub,
    );
  }

  // 최근 재생곡 20개
  @UseGuards(AuthGuard)
  @Get('recently-played')
  getRecentlyPlayed(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.spotifyService.getRecentlyPlayed(
      request.user.sub,
      20,
    );
  }
}