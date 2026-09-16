import { Injectable } from '@nestjs/common';

import { SpotifyService } from '../spotify/spotify.service.js';
import { LastfmService } from '../lastfm/lastfm.service.js';
import { GroqService } from '../groq/groq.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MusicService {
  constructor(
    private readonly spotifyService: SpotifyService,
    private readonly lastfmService: LastfmService,
    private readonly groqService: GroqService,
    private readonly prisma: PrismaService,
  ) {}

  async analyzeCurrentTrack(userId: number) {
    // 1. Spotify 현재 재생곡 조회
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
        cached: false,
      };
    }

    const {
      spotifyTrackId,
      title,
      artist,
      albumImage,
    } = spotify.track;

    // 2. 이미 분석한 곡인지 DB 확인
    const cachedAnalysis =
      await this.prisma.trackAnalysis.findUnique({
        where: {
          spotifyTrackId,
        },
      });

    // 3. 이미 있다면 Groq 호출 없이 바로 반환
    if (cachedAnalysis) {
      return {
        isPlaying: spotify.isPlaying,

        track: spotify.track,

        musicDNA: {
          energy: cachedAnalysis.energy,
          dreaminess:
            cachedAnalysis.dreaminess,
          confidence:
            cachedAnalysis.confidence,
          darkness: cachedAnalysis.darkness,
          danceability:
            cachedAnalysis.danceability,
          moodTags: cachedAnalysis.moodTags,
        },

        cached: true,
      };
    }

    // 4. 처음 보는 곡이면 Last.fm 조회
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

    // 5. Groq로 Music DNA 생성
    const musicDNA =
      await this.groqService.analyzeMusic(
        title,
        artist,
        trackInfo.tags,
        similarTracks,
      );

    // 6. 분석 결과 DB 저장
    await this.prisma.trackAnalysis.create({
      data: {
        spotifyTrackId,
        title,
        artist,
        albumImage,

        energy: musicDNA.energy,
        dreaminess: musicDNA.dreaminess,
        confidence: musicDNA.confidence,
        darkness: musicDNA.darkness,
        danceability:
          musicDNA.danceability,

        moodTags: musicDNA.moodTags,
      },
    });

    // 7. 결과 반환
    return {
      isPlaying: spotify.isPlaying,

      track: spotify.track,

      tags: trackInfo.tags,
      similarTracks,

      musicDNA,

      cached: false,
    };
  }
}