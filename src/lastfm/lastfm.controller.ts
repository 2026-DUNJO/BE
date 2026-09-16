import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import { LastfmService } from './lastfm.service.js';

@Controller('lastfm')
export class LastfmController {
  constructor(
    private readonly lastfmService: LastfmService,
  ) {}

  @Get('track-info')
  getTrackInfo(
    @Query('artist') artist: string,
    @Query('track') track: string,
  ) {
    return this.lastfmService.getTrackInfo(
      artist,
      track,
    );
  }

  @Get('similar-tracks')
  getSimilarTracks(
    @Query('artist') artist: string,
    @Query('track') track: string,
  ) {
    return this.lastfmService.getSimilarTracks(
      artist,
      track,
    );
  }
}