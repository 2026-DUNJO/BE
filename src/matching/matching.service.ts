import { Injectable } from '@nestjs/common';

import {
  GroqService,
  type MatchAIResult,
} from '../groq/groq.service.js';

import { LastfmService } from '../lastfm/lastfm.service.js';
import { LocationService } from '../location/location.service.js';
import { SpotifyService } from '../spotify/spotify.service.js';

interface RecentTrack {
  spotifyTrackId: string;
  title: string;
  artist: string;
  albumImage?: string | null;
  spotifyUrl?: string | null;
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
    albumImage?: string | null;
    spotifyUrl?: string | null;
  };

  otherTrack: {
    spotifyTrackId: string;
    title: string;
    artist: string;
    albumImage?: string | null;
    spotifyUrl?: string | null;
  };

  match: number;

  connectionType:
    | 'SAME_TRACK'
    | 'LASTFM_SIMILAR';
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
    private readonly groqService: GroqService,
  ) {}

  // =========================================
  // 실제 주변 사용자 매칭 검색
  // =========================================

  async searchMatch(userId: number) {
    console.log('\n========================================');
    console.log(`🔍 MATCH SEARCH START - user ${userId}`);
    console.log('========================================');

    // -----------------------------------------
    // 1. 내 최근 재생곡 조회
    // -----------------------------------------

    const myTracks =
      (await this.spotifyService.getRecentlyPlayed(
        userId,
        20,
      )) as RecentTrack[];

    console.log(
      `🎵 내 최근곡 개수: ${myTracks.length}`,
    );

    console.log(
      '🎵 내 최근곡:',
      myTracks.map((track) => ({
        title: track.title,
        artist: track.artist,
        spotifyTrackId:
          track.spotifyTrackId,
      })),
    );

    if (myTracks.length === 0) {
      console.log(
        '❌ 매칭 종료: 내 최근 재생 기록 없음',
      );

      return {
        matched: false,
        message:
          '최근 재생 기록이 없습니다.',
        candidates: [],
      };
    }

    // -----------------------------------------
    // 2. 1km 이내 사용자 조회
    // -----------------------------------------

    const nearbyUsers =
      await this.locationService.findNearbyUsers(
        userId,
      );

    console.log(
      `📍 1km 이내 사용자 수: ${nearbyUsers.length}`,
    );

    console.log(
      '📍 주변 사용자:',
      nearbyUsers.map((user) => ({
        id: user.id,
        userId: user.userId,
        nickname: user.nickname,
        distanceKm: user.distanceKm,
      })),
    );

    if (nearbyUsers.length === 0) {
      console.log(
        '❌ 매칭 종료: 주변 사용자 없음',
      );

      return {
        matched: false,
        message:
          '1km 이내에 사용자가 없습니다.',
        candidates: [],
      };
    }

    // -----------------------------------------
    // 3. 내 곡들의 Last.fm Similar TOP 50
    //    미리 한 번만 조회
    // -----------------------------------------

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

        console.log(
          `🎧 Last.fm: ${myTrack.artist} - ${myTrack.title} → ${similarTracks.length}개`,
        );
      } catch (error) {
        console.error(
          `❌ Last.fm 조회 실패: ${myTrack.artist} - ${myTrack.title}`,
          error,
        );

        // 특정 곡에서 Last.fm 조회가 실패해도
        // 전체 매칭은 계속 진행
        mySimilarTracks.set(
          myTrack.spotifyTrackId,
          [],
        );
      }
    }

    // -----------------------------------------
    // 4. 주변 사용자 각각 비교
    // -----------------------------------------

    const candidates = [];

    for (const nearbyUser of nearbyUsers) {
      console.log(
        '\n----------------------------------------',
      );

      console.log(
        `👤 후보 비교 시작: ${nearbyUser.nickname} (${nearbyUser.id})`,
      );

      console.log(
        '----------------------------------------',
      );

      try {
        // 상대방 최근곡
        const otherTracks =
          (await this.spotifyService.getRecentlyPlayed(
            nearbyUser.id,
            20,
          )) as RecentTrack[];

        console.log(
          `🎵 상대 최근곡 개수: ${otherTracks.length}`,
        );

        console.log(
          '🎵 상대 최근곡:',
          otherTracks.map(
            (track) => ({
              title: track.title,
              artist: track.artist,
              spotifyTrackId:
                track.spotifyTrackId,
            }),
          ),
        );

        if (otherTracks.length === 0) {
          console.log(
            '❌ 후보 제외: 상대 최근곡 없음',
          );

          continue;
        }

        // -------------------------------------
        // 곡 연결 탐색
        // -------------------------------------

        const connections =
          this.findTrackConnectionsFromCache(
            myTracks,
            otherTracks,
            mySimilarTracks,
          );

        console.log(
          `🔗 발견된 원본 연결 수: ${connections.length}`,
        );

        console.log(
          '🔗 발견된 연결:',
          connections.map(
            (connection) => ({
              myTrack:
                `${connection.myTrack.artist} - ${connection.myTrack.title}`,

              otherTrack:
                `${connection.otherTrack.artist} - ${connection.otherTrack.title}`,

              match:
                connection.match,

              type:
                connection.connectionType,
            }),
          ),
        );

        // -------------------------------------
        // DUNJO 유사도 계산
        // -------------------------------------

        const similarityResult =
          this.calculateDunjoSimilarity(
            myTracks,
            connections,
          );

        console.log(
          '\n📊 ===== DUNJO SCORE =====',
        );

        console.log(
          `연결된 내 곡: ${similarityResult.connectedTrackCount}/${similarityResult.totalMyTrackCount}`,
        );

        console.log(
          `Coverage: ${similarityResult.coverage}%`,
        );

        console.log(
          `Strength: ${similarityResult.strength}%`,
        );

        console.log(
          `최종 Similarity: ${similarityResult.similarity}`,
        );

        console.log(
          `매칭 여부: ${
            similarityResult.matched
              ? '✅ MATCH'
              : '❌ FAIL'
          }`,
        );

        console.log(
          '==========================\n',
        );

        // -------------------------------------
        // 대표 연결곡 선정
        // -------------------------------------

        const representativeConnection =
          this.getRepresentativeConnection(
            similarityResult.connections,
          );

        if (representativeConnection) {
          console.log(
            '⭐ 대표 연결곡:',
            {
              myTrack:
                `${representativeConnection.myTrack.artist} - ${representativeConnection.myTrack.title}`,

              otherTrack:
                `${representativeConnection.otherTrack.artist} - ${representativeConnection.otherTrack.title}`,

              match:
                representativeConnection.match,

              type:
                representativeConnection.connectionType,
            },
          );
        } else {
          console.log(
            '⭐ 대표 연결곡 없음',
          );
        }

        // -------------------------------------
        // AI 분석
        //
        // 70점 이상으로 이미 MATCH가 확정된
        // 사용자에게만 Groq 호출
        // -------------------------------------

        let ai: MatchAIResult | null = null;

        if (similarityResult.matched) {
          console.log(
            '🤖 70점 이상 → Groq 분석 시작',
          );

          try {
            ai =
              await this.groqService.generateMatchAI(
                similarityResult.similarity,
                similarityResult.coverage,
                similarityResult.strength,
                similarityResult.connections,
              );

            console.log(
              '🤖 Groq 분석 성공',
            );
          } catch (error) {
            // AI 분석이 실패해도
            // 이미 성립된 MATCH 자체는 유지
            console.error(
              `❌ Groq 매칭 분석 실패: user ${nearbyUser.id}`,
              error,
            );
          }
        } else {
          console.log(
            `⛔ ${similarityResult.similarity}점 → 70점 미만`,
          );
        }

        candidates.push({
          user: {
            id: nearbyUser.id,
            userId:
              nearbyUser.userId,
            nickname:
              nearbyUser.nickname,
          },

          distanceKm:
            nearbyUser.distanceKm,

          ...similarityResult,

          representativeConnection,

          ai,
        });
      } catch (error) {
        console.error(
          `❌ 매칭 후보 처리 실패: user ${nearbyUser.id}`,
          error,
        );

        // Spotify 미연결 등 특정 사용자 문제로
        // 전체 검색이 중단되지 않도록 건너뜀
        continue;
      }
    }

    // -----------------------------------------
    // 5. 유사도 높은 순 정렬
    // -----------------------------------------

    candidates.sort(
      (a, b) =>
        b.similarity -
        a.similarity,
    );

    // -----------------------------------------
    // 6. 70점 이상만 실제 매칭
    // -----------------------------------------

    const matches =
      candidates.filter(
        (candidate) =>
          candidate.matched,
      );

    // -----------------------------------------
    // 최종 디버깅 결과
    // -----------------------------------------

    console.log(
      '\n========================================',
    );

    console.log(
      '🏁 MATCH SEARCH RESULT',
    );

    console.log(
      `전체 후보: ${candidates.length}`,
    );

    console.log(
      `매칭 성공: ${matches.length}`,
    );

    console.log(
      '후보 점수:',
      candidates.map(
        (candidate) => ({
          user:
            candidate.user.nickname,

          userId:
            candidate.user.userId,

          distanceKm:
            candidate.distanceKm,

          similarity:
            candidate.similarity,

          coverage:
            candidate.coverage,

          strength:
            candidate.strength,

          connectedTracks:
            `${candidate.connectedTrackCount}/${candidate.totalMyTrackCount}`,

          matched:
            candidate.matched,
        }),
      ),
    );

    console.log(
      '========================================\n',
    );

    return {
      matched:
        matches.length > 0,

      matches,

      // 개발 중 점수 확인용
      candidates,
    };
  }

  // =========================================
  // Last.fm 결과를 이용한 곡 연결 탐색
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
    const connections: TrackConnection[] =
      [];

    for (const myTrack of myTracks) {
      // ---------------------------------------
      // ① 동일 Spotify 곡 확인
      // ---------------------------------------

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

            albumImage:
              myTrack.albumImage,

            spotifyUrl:
              myTrack.spotifyUrl,
          },

          otherTrack: {
            spotifyTrackId:
              sameTrack.spotifyTrackId,

            title:
              sameTrack.title,

            artist:
              sameTrack.artist,

            albumImage:
              sameTrack.albumImage,

            spotifyUrl:
              sameTrack.spotifyUrl,
          },

          // 완전히 동일한 Spotify 곡
          match: 1,

          connectionType:
            'SAME_TRACK',
        });

        // 동일곡을 찾았으면
        // 이 곡은 Last.fm 비교 불필요
        continue;
      }

      // ---------------------------------------
      // ② 동일곡이 없다면 Last.fm 비교
      // ---------------------------------------

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

            albumImage:
              myTrack.albumImage,

            spotifyUrl:
              myTrack.spotifyUrl,
          },

          otherTrack: {
            spotifyTrackId:
              otherTrack.spotifyTrackId,

            title:
              otherTrack.title,

            artist:
              otherTrack.artist,

            albumImage:
              otherTrack.albumImage,

            spotifyUrl:
              otherTrack.spotifyUrl,
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
      } catch (error) {
        console.error(
          `Last.fm 조회 실패: ${myTrack.artist} - ${myTrack.title}`,
          error,
        );

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

    // -----------------------------------------
    // 내 곡 하나당 가장 강한 연결 하나만 사용
    // -----------------------------------------

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

    // -----------------------------------------
    // Coverage
    // -----------------------------------------

    const connectedTrackCount =
      bestConnections.length;

    const coverage =
      connectedTrackCount /
      myTracks.length;

    // -----------------------------------------
    // Strength
    // -----------------------------------------

    let strength = 0;

    if (
      bestConnections.length > 0
    ) {
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

    // -----------------------------------------
    // Coverage 보정
    // -----------------------------------------

    const adjustedCoverage =
      Math.sqrt(coverage);

    // -----------------------------------------
    // DUNJO Score
    //
    // 보정 Coverage = 60%
    // Strength       = 40%
    // -----------------------------------------

    const rawSimilarity =
      adjustedCoverage * 60 +
      strength * 40;

    const similarity =
      Math.round(
        rawSimilarity * 100,
      ) / 100;

    const matched =
      similarity >= 70;

    return {
      similarity,

      // API에는 실제 Coverage %를 반환
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
  // MatchSuccess 화면에 보여줄
  // 대표 연결곡 선정
  // =========================================

  private getRepresentativeConnection(
    connections: TrackConnection[],
  ): TrackConnection | null {
    if (connections.length === 0) {
      return null;
    }

    return connections.reduce(
      (best, current) => {
        // -------------------------------------
        // 연결 강도가 더 높은 것을 우선
        // -------------------------------------

        if (
          current.match >
          best.match
        ) {
          return current;
        }

        if (
          current.match <
          best.match
        ) {
          return best;
        }

        // -------------------------------------
        // 강도가 같다면 동일곡을 우선
        // -------------------------------------

        if (
          current.connectionType ===
            'SAME_TRACK' &&
          best.connectionType !==
            'SAME_TRACK'
        ) {
          return current;
        }

        return best;
      },
    );
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