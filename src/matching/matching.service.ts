import { Injectable } from '@nestjs/common';

import { LastfmService } from '../lastfm/lastfm.service.js';

interface RecentTrack {
  spotifyTrackId: string;
  title: string;
  artist: string;
}

interface SimilarTrack {
  title: string;
  artist: string;
  match: number;
  lastfmUrl?: string;
}

interface TrackConnection {
  myTrack: {
    spotifyTrackId: string;
    title: string;
    artist: string;
  };

  otherTrack: {
    spotifyTrackId: string;
    title: string;
    artist: string;
  };

  match: number;
}

@Injectable()
export class MatchingService {
  constructor(
    private readonly lastfmService: LastfmService,
  ) {}

  // =========================================
  // 두 사용자의 최근곡 사이 연결 탐색
  // =========================================

  async findTrackConnections(
    myTracks: RecentTrack[],
    otherTracks: RecentTrack[],
  ): Promise<TrackConnection[]> {
    const connections: TrackConnection[] = [];

    // 내 최근곡을 하나씩 검사
    for (const myTrack of myTracks) {
      // 내 곡의 Last.fm Similar TOP 50 조회
      const similarTracks =
        (await this.lastfmService.getSimilarTracks(
          myTrack.artist,
          myTrack.title,
        )) as SimilarTrack[];

      // Similar TOP 50 안에
      // 상대 최근곡이 존재하는지 확인
      for (const otherTrack of otherTracks) {
        const found = similarTracks.find(
          (similarTrack) =>
            this.isSameTrack(
              similarTrack,
              otherTrack,
            ),
        );

        if (!found) {
          continue;
        }

        connections.push({
          myTrack: {
            spotifyTrackId:
              myTrack.spotifyTrackId,

            title:
              myTrack.title,

            artist:
              myTrack.artist,
          },

          otherTrack: {
            spotifyTrackId:
              otherTrack.spotifyTrackId,

            title:
              otherTrack.title,

            artist:
              otherTrack.artist,
          },

          match:
            found.match,
        });
      }
    }

    return connections;
  }

  // =========================================
  // 같은 곡인지 비교
  // =========================================

  private isSameTrack(
    first: {
      title: string;
      artist: string;
    },
    second: {
      title: string;
      artist: string;
    },
  ): boolean {
    return (
      this.normalize(first.title) ===
        this.normalize(second.title) &&
      this.normalize(first.artist) ===
        this.normalize(second.artist)
    );
  }

  // =========================================
  // 문자열 정규화
  // =========================================

  private normalize(
    value: string,
  ): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }
}