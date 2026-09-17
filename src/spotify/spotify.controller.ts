import {
  Controller,
  Get,
  Query,
  Redirect,
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

  // =========================================
  // Spotify 연결 상태 확인
  // =========================================

  @UseGuards(AuthGuard)
  @Get('status')
  getStatus(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.spotifyService.getConnectionStatus(
      request.user.sub,
    );
  }

  // =========================================
  // Spotify 로그인
  // =========================================

  @UseGuards(AuthGuard)
  @Get('login')
  login(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.spotifyService.createLoginUrl(
      request.user.sub,
    );
  }

  // =========================================
  // Spotify OAuth Callback
  // =========================================

  @Get('callback')
  @Redirect(
    'http://localhost:5173/home',
    302,
  )
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    await this.spotifyService.handleCallback(
      code,
      state,
    );

    return {
      url: 'http://localhost:5173/home',
    };
  }

  // =========================================
  // 현재 재생 중인 곡
  // =========================================

  @UseGuards(AuthGuard)
  @Get('current-track')
  getCurrentTrack(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.spotifyService.getCurrentTrack(
      request.user.sub,
    );
  }

  // =========================================
  // 최근 재생곡 20개
  // =========================================

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

  // =========================================
  // Spotify 곡 검색
  // =========================================

  @UseGuards(AuthGuard)
  @Get('search')
  searchTracks(
    @Req() request: AuthenticatedRequest,
    @Query('q') query: string,
  ) {
    return this.spotifyService.searchTracks(
      request.user.sub,
      query,
    );
  }
}