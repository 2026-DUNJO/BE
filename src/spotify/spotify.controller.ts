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

  @UseGuards(AuthGuard)
  @Get('login')
  login(@Req() request: AuthenticatedRequest) {
    return this.spotifyService.createLoginUrl(
      request.user.sub,
    );
  }

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

  @UseGuards(AuthGuard)
  @Get('current-track')
  getCurrentTrack(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.spotifyService.getCurrentTrack(
      request.user.sub,
    );
  }
}