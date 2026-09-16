import { Injectable } from '@nestjs/common';

import { LastfmService } from '../lastfm/lastfm.service.js';
import { LocationService } from '../location/location.service.js';
import { SpotifyService } from '../spotify/spotify.service.js';

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

  // 어떤 방식으로 연결됐는지 확인용
  connectionType: 'SAME_TRACK' | 'LASTFM_SIMILAR';
}

interface SimilarityResult {
  similarity: number;
  coverage: number;
  strength: number;
  matched: boolean;
  connectedTrackCount: number;
  totalMyTrackCount: number;
  connections: TrackConnection[];
}

@Injectable()
export class MatchingService {
  constructor(
    private readonly lastfmService: LastfmService,
    private readonly locationService: LocationService,
    private readonly spotifyService: SpotifyService,
  ) {}

  // =========================================
  // 실제 주변 사용자 매칭 검색
  // =========================================

  async searchMatch(userId: number) {
    // 1. 내 최근 재생곡
    const myTracks =
      (await this.spotifyService.getRecentlyPlayed(
        userId,
        20,
      )) as RecentTrack[];

    if (myTracks.length === 0) {
      return {
        matched: false,
        message: '최근 재생 기록이 없습니다.',
        candidates: [],
      };
    }

    // 2. 1km 이내 사용자
    const nearbyUsers =
      await this.locationService.findNearbyUsers(
        userId,
      );

    if (nearbyUsers.length === 0) {
      return {
        matched: false,
        message: '1km 이내에 사용자가 없습니다.',
        candidates: [],
      };
    }

    // =========================================
    // 3. 내 최근곡들의 Last.fm Similar TOP 50
    //
    // 후보마다 다시 Last.fm을 호출하지 않고
    // 한 번 조회해서 재사용
    // =========================================

    const mySimilarTracks =
      new Map<string, SimilarTrack[]>();

    for (const myTrack of myTracks) {
      try {
        const similarTracks =
          (await this.lastfmService.getSimilarTracks(
            myTrack.artist,
            myTrack.title,
          )) as SimilarTrack[];

        mySimilarTracks.set(
          myTrack.spotifyTrackId,
          similarTracks,
        );
      } catch {
        // 특정 곡의 Last.fm 조회가 실패해도
        // 전체 매칭은 계속 진행
        mySimilarTracks.set(
          myTrack.spotifyTrackId,
          [],
        );
      }
    }

    // =========================================
    // 4. 주변 사용자 각각 비교
    // =========================================

    const candidates = [];

    for (const nearbyUser of nearbyUsers) {
      try {
        const otherTracks =
          (await this.spotifyService.getRecentlyPlayed(
            nearbyUser.id,
            20,
          )) as RecentTrack[];

        if (otherTracks.length === 0) {
          continue;
        }

        const connections =
          this.findTrackConnectionsFromCache(
            myTracks,
            otherTracks,
            mySimilarTracks,
          );

        const similarityResult =
          this.calculateDunjoSimilarity(
            myTracks,
            connections,
          );

        candidates.push({
          user: {
            id: nearbyUser.id,
            userId: nearbyUser.userId,
            nickname: nearbyUser.nickname,
          },

          distanceKm:
            nearbyUser.distanceKm,

          ...similarityResult,
        });
      } catch {
        // Spotify 미연결 등
        // 특정 사용자 문제 때문에
        // 전체 매칭이 중단되지 않도록 건너뜀
        continue;
      }
    }

    // =========================================
    // 5. 유사도 높은 순 정렬
    // =========================================

    candidates.sort(
      (a, b) =>
        b.similarity - a.similarity,
    );

    // =========================================
    // 6. 70점 이상만 매칭 성공
    // =========================================

    const matches =
      candidates.filter(
        (candidate) =>
          candidate.matched,
      );

    return {
      matched:
        matches.length > 0,

      matches,

      // 개발/점수 검증용
      candidates,
    };
  }

  // =========================================
  // 곡 연결 탐색
  //
  // 1순위: Spotify 동일곡
  // 2순위: Last.fm Similar TOP 50
  // =========================================

  private findTrackConnectionsFromCache(
    myTracks: RecentTrack[],
    otherTracks: RecentTrack[],
    mySimilarTracks: Map<
      string,
      SimilarTrack[]
    >,
  ): TrackConnection[] {
    const connections: TrackConnection[] = [];

    for (const myTrack of myTracks) {
      // =======================================
      // ① 상대방에게 동일한 Spotify 곡이 있는지
      // =======================================

      const sameTrack =
        otherTracks.find(
          (otherTrack) =>
            otherTrack.spotifyTrackId ===
            myTrack.spotifyTrackId,
        );

      if (sameTrack) {
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
              sameTrack.spotifyTrackId,

            title:
              sameTrack.title,

            artist:
              sameTrack.artist,
          },

          // 완전히 동일한 곡
          match: 1,

          connectionType:
            'SAME_TRACK',
        });

        // 동일곡을 이미 발견했으므로
        // 이 myTrack은 Last.fm 비교할 필요 없음
        continue;
      }

      // =======================================
      // ② 동일곡이 없다면 Last.fm 비교
      // =======================================

      const similarTracks =
        mySimilarTracks.get(
          myTrack.spotifyTrackId,
        ) ?? [];

      for (const otherTrack of otherTracks) {
        const found =
          similarTracks.find(
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

          connectionType:
            'LASTFM_SIMILAR',
        });
      }
    }

    return connections;
  }

  // =========================================
  // 두 곡 목록 직접 비교용
  // =========================================

  async findTrackConnections(
    myTracks: RecentTrack[],
    otherTracks: RecentTrack[],
  ): Promise<TrackConnection[]> {
    const mySimilarTracks =
      new Map<string, SimilarTrack[]>();

    for (const myTrack of myTracks) {
      try {
        const similarTracks =
          (await this.lastfmService.getSimilarTracks(
            myTrack.artist,
            myTrack.title,
          )) as SimilarTrack[];

        mySimilarTracks.set(
          myTrack.spotifyTrackId,
          similarTracks,
        );
      } catch {
        mySimilarTracks.set(
          myTrack.spotifyTrackId,
          [],
        );
      }
    }

    return this.findTrackConnectionsFromCache(
      myTracks,
      otherTracks,
      mySimilarTracks,
    );
  }

  // =========================================
  // DUNJO 유사도 계산
  // =========================================

  calculateDunjoSimilarity(
    myTracks: RecentTrack[],
    connections: TrackConnection[],
  ): SimilarityResult {
    if (myTracks.length === 0) {
      return {
        similarity: 0,
        coverage: 0,
        strength: 0,
        matched: false,
        connectedTrackCount: 0,
        totalMyTrackCount: 0,
        connections: [],
      };
    }

    // =========================================
    // 내 곡 하나당 가장 강한 연결 하나만 사용
    //
    // 한 곡이 상대곡 여러 개와 연결돼도
    // 점수가 과도하게 올라가는 것 방지
    // =========================================

    const bestConnectionByTrack =
      new Map<
        string,
        TrackConnection
      >();

    for (const connection of connections) {
      const trackId =
        connection.myTrack.spotifyTrackId;

      const currentBest =
        bestConnectionByTrack.get(
          trackId,
        );

      if (
        !currentBest ||
        connection.match >
          currentBest.match
      ) {
        bestConnectionByTrack.set(
          trackId,
          connection,
        );
      }
    }

    const bestConnections =
      Array.from(
        bestConnectionByTrack.values(),
      );

    // =========================================
    // Coverage
    //
    // 내 최근곡 중 몇 곡이
    // 상대와 연결됐는가?
    // =========================================

    const connectedTrackCount =
      bestConnections.length;

    const coverage =
      connectedTrackCount /
      myTracks.length;

    // =========================================
    // Strength
    //
    // 연결된 곡들이 얼마나 강하게
    // 연결되어 있는가?
    // =========================================

    let strength = 0;

    if (bestConnections.length > 0) {
      const totalStrength =
        bestConnections.reduce(
          (
            sum,
            connection,
          ) =>
            sum +
            connection.match,
          0,
        );

      strength =
        totalStrength /
        bestConnections.length;
    }

    // =========================================
    // DUNJO Score
    //
    // 현재 테스트 공식
    //
    // Coverage 60%
    // Strength 40%
    //
    // 추후 실제 데이터로 조정 예정
    // =========================================

    const adjustedCoverage =
        Math.sqrt(coverage);

    const rawSimilarity =
      adjustedCoverage * 60 +
      strength * 40;

    const similarity =
      Math.round(
        rawSimilarity * 100,
      ) / 100;

    // 현재 매칭 기준
    const matched =
      similarity >= 70;

    return {
      similarity,

      coverage:
        Math.round(
          coverage * 10000,
        ) / 100,

      strength:
        Math.round(
          strength * 10000,
        ) / 100,

      matched,

      connectedTrackCount,

      totalMyTrackCount:
        myTracks.length,

      connections:
        bestConnections,
    };
  }

  // =========================================
  // Last.fm 곡과 Spotify 곡 비교
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
      this.normalize(
        first.title,
      ) ===
        this.normalize(
          second.title,
        ) &&
      this.normalize(
        first.artist,
      ) ===
        this.normalize(
          second.artist,
        )
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