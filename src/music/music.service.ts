import { Injectable } from '@nestjs/common';

import { SpotifyService } from '../spotify/spotify.service.js';
import { LastfmService } from '../lastfm/lastfm.service.js';
import { GroqService } from '../groq/groq.service.js';

@Injectable()
export class MusicService {
  constructor(
    private readonly spotifyService: SpotifyService,
    private readonly lastfmService: LastfmService,
    private readonly groqService: GroqService,
  ) {}

  async analyzeCurrentTrack(userId: number) {
    const spotify =
      await this.spotifyService.getCurrentTrack(
        userId,
      );

    if (!spotify.track) {
      return {
        isPlaying: false,
        track: null,
        tags: [],
        similarTracks: [],
        musicDNA: null,
      };
    }

    const { title, artist } = spotify.track;

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

    const musicDNA =
      await this.groqService.analyzeMusic(
        title,
        artist,
        trackInfo.tags,
        similarTracks,
      );

    return {
      isPlaying: spotify.isPlaying,
      track: spotify.track,
      tags: trackInfo.tags,
      similarTracks,
      musicDNA,
    };
  }
}