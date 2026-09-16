import { Injectable } from '@nestjs/common';

import { SpotifyService } from '../spotify/spotify.service.js';
import { LastfmService } from '../lastfm/lastfm.service.js';

@Injectable()
export class MusicService {
  constructor(
    private readonly spotifyService: SpotifyService,
    private readonly lastfmService: LastfmService,
  ) {}

  async analyzeCurrentTrack(userId: number) {
    // 1. Spotify 현재곡
    const spotify =
      await this.spotifyService.getCurrentTrack(userId);

    if (!spotify.track) {
      return {
        isPlaying: false,
        track: null,
        tags: [],
        similarTracks: [],
      };
    }

    const {
      title,
      artist,
    } = spotify.track;

    // 2. Last.fm 곡 정보 + 유사곡 병렬 요청
    const [trackInfo, similarTracks] =
      await Promise.all([
        this.lastfmService.getTrackInfo(
          artist,
          title,
        ),

        this.lastfmService.getSimilarTracks(
          artist,
          title,
        ),
      ]);

    return {
      isPlaying: spotify.isPlaying,

      track: spotify.track,

      tags: trackInfo.tags,

      similarTracks,
    };
  }
}