import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard.js';

import { MusicService } from './music.service.js';

@Controller('music')
export class MusicController {
  constructor(
    private readonly musicService: MusicService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('current-analysis')
  getCurrentAnalysis(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.musicService.analyzeCurrentTrack(
      request.user.sub,
    );
  }
}