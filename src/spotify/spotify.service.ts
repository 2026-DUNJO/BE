import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service.js';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface SpotifyProfile {
  id: string;
  display_name: string | null;
}

interface SpotifyCurrentlyPlaying {
  is_playing: boolean;

  item: {
    id: string;
    name: string;

    artists: {
      name: string;
    }[];

    album: {
      images: {
        url: string;
      }[];
    };

    external_urls: {
      spotify: string;
    };
  } | null;
}

// 최근 재생곡 API 응답 타입
interface SpotifyRecentlyPlayed {
  items: {
    played_at: string;

    track: {
      id: string;
      name: string;

      artists: {
        name: string;
      }[];

      album: {
        images: {
          url: string;
        }[];
      };

      external_urls: {
        spotify: string;
      };
    };
  }[];
}

@Injectable()
export class SpotifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // =========================================
  // Spotify 로그인 URL 생성
  // =========================================

  async createLoginUrl(userId: number) {
    const state =
      await this.jwtService.signAsync(
        {
          sub: userId,
          purpose: 'spotify-oauth',
        },
        {
          expiresIn: '10m',
        },
      );

    const params = new URLSearchParams({
      client_id:
        process.env.SPOTIFY_CLIENT_ID!,

      response_type: 'code',

      redirect_uri:
        process.env.SPOTIFY_REDIRECT_URI!,

      scope:
        'user-read-currently-playing user-read-playback-state user-read-recently-played',

      state,
    });

    return {
      url:
        `https://accounts.spotify.com/authorize?` +
        params.toString(),
    };
  }

  // =========================================
  // Spotify OAuth callback
  // =========================================

  async handleCallback(
    code: string,
    state: string,
  ) {
    if (!code || !state) {
      throw new BadRequestException(
        'Spotify 인증 정보가 올바르지 않습니다.',
      );
    }

    let userId: number;

    try {
      const payload =
        await this.jwtService.verifyAsync<{
          sub: number;
          purpose: string;
        }>(state);

      if (
        payload.purpose !==
        'spotify-oauth'
      ) {
        throw new Error();
      }

      userId = payload.sub;
    } catch {
      throw new UnauthorizedException(
        'Spotify 인증 요청이 만료되었거나 유효하지 않습니다.',
      );
    }

    const credentials = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
    ).toString('base64');

    const tokenResponse = await fetch(
      'https://accounts.spotify.com/api/token',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Basic ${credentials}`,

          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
          grant_type:
            'authorization_code',

          code,

          redirect_uri:
            process.env
              .SPOTIFY_REDIRECT_URI!,
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new BadRequestException(
        'Spotify 토큰 발급에 실패했습니다.',
      );
    }

    const tokens =
      (await tokenResponse.json()) as SpotifyTokenResponse;

    // =========================================
    // Spotify 프로필 조회
    // =========================================

    const profileResponse = await fetch(
      'https://api.spotify.com/v1/me',
      {
        headers: {
          Authorization:
            `Bearer ${tokens.access_token}`,
        },
      },
    );

    if (!profileResponse.ok) {

      throw new BadRequestException(
        'Spotify 사용자 정보를 가져오지 못했습니다.',
      );
    }

    const profile =
      (await profileResponse.json()) as SpotifyProfile;

    const expiresAt = new Date(
      Date.now() +
        tokens.expires_in * 1000,
    );

    // =========================================
    // Spotify 계정 DB 저장
    // =========================================

    const existingAccount =
      await this.prisma.spotifyAccount.findUnique(
        {
          where: {
            userId,
          },
        },
      );

    if (existingAccount) {
      await this.prisma.spotifyAccount.update({
        where: {
          userId,
        },

        data: {
          spotifyUserId:
            profile.id,

          accessToken:
            tokens.access_token,

          refreshToken:
            tokens.refresh_token ??
            existingAccount.refreshToken,

          expiresAt,
        },
      });
    } else {
      if (!tokens.refresh_token) {
        throw new BadRequestException(
          'Spotify refresh token을 받지 못했습니다.',
        );
      }

      await this.prisma.spotifyAccount.create({
        data: {
          userId,

          spotifyUserId:
            profile.id,

          accessToken:
            tokens.access_token,

          refreshToken:
            tokens.refresh_token,

          expiresAt,
        },
      });
    }

    return {
      connected: true,

      spotifyUserId:
        profile.id,

      displayName:
        profile.display_name,
    };
  }

  // =========================================
  // 현재 재생 중인 곡 조회
  // =========================================

  async getCurrentTrack(
    userId: number,
  ) {
    const account =
      await this.prisma.spotifyAccount.findUnique(
        {
          where: {
            userId,
          },
        },
      );

    if (!account) {
      throw new UnauthorizedException(
        'Spotify 계정 연결이 필요합니다.',
      );
    }

    const accessToken =
      await this.getValidAccessToken(
        userId,
      );

    const response = await fetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    );

    // 아무것도 재생 중이지 않음
    if (response.status === 204) {
      return {
        isPlaying: false,
        track: null,
      };
    }

    if (!response.ok) {
      throw new BadRequestException(
        '현재 재생 중인 곡을 가져오지 못했습니다.',
      );
    }

    const data =
      (await response.json()) as SpotifyCurrentlyPlaying;

    if (!data.item) {
      return {
        isPlaying: false,
        track: null,
      };
    }

    return {
      isPlaying:
        data.is_playing,

      track: {
        spotifyTrackId:
          data.item.id,

        title:
          data.item.name,

        artist:
          data.item.artists
            .map(
              (artist) =>
                artist.name,
            )
            .join(', '),

        albumImage:
          data.item.album
            .images[0]?.url ??
          null,

        spotifyUrl:
          data.item.external_urls
            .spotify,
      },
    };
  }

  // =========================================
  // 최근 재생곡 조회 ⭐
  // =========================================

  async getRecentlyPlayed(
    userId: number,
    limit = 20,
  ) {
    const accessToken =
      await this.getValidAccessToken(
        userId,
      );

    // Spotify API 최대 limit은 50
    const safeLimit = Math.min(
      Math.max(limit, 1),
      50,
    );

    const response = await fetch(
      `https://api.spotify.com/v1/me/player/recently-played?limit=${safeLimit}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error =
        await response.text();

      throw new BadRequestException(
        `최근 재생곡을 가져오지 못했습니다. ${response.status}: ${error}`,
      );
    }

    const data =
      (await response.json()) as SpotifyRecentlyPlayed;

    // =========================================
    // 필요한 데이터만 정리
    // =========================================

    const tracks = data.items.map(
      (item) => ({
        spotifyTrackId:
          item.track.id,

        title:
          item.track.name,

        artist:
          item.track.artists
            .map(
              (artist) =>
                artist.name,
            )
            .join(', '),

        albumImage:
          item.track.album
            .images[0]?.url ??
          null,

        spotifyUrl:
          item.track.external_urls
            .spotify,

        playedAt:
          item.played_at,
      }),
    );

    // =========================================
    // 같은 곡 중복 제거
    // =========================================

    const uniqueTracks = Array.from(
      new Map(
        tracks.map((track) => [
          track.spotifyTrackId,
          track,
        ]),
      ).values(),
    );

    return uniqueTracks;
  }

  // =========================================
  // Access Token 유효성 확인
  // =========================================

  private async getValidAccessToken(
    userId: number,
  ): Promise<string> {
    const account =
      await this.prisma.spotifyAccount.findUnique(
        {
          where: {
            userId,
          },
        },
      );

    if (!account) {
      throw new UnauthorizedException(
        'Spotify 계정 연결이 필요합니다.',
      );
    }

    // 만료까지 1분 이상 남았으면
    // 기존 access token 사용
    if (
      account.expiresAt.getTime() >
      Date.now() + 60_000
    ) {
      return account.accessToken;
    }

    // 만료됐거나 곧 만료될 예정이면 갱신
    return this.refreshAccessToken(
      userId,
      account.refreshToken,
    );
  }

  // =========================================
  // Refresh Token으로 Access Token 갱신
  // =========================================

  private async refreshAccessToken(
    userId: number,
    refreshToken: string,
  ): Promise<string> {
    const credentials = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
    ).toString('base64');

    const response = await fetch(
      'https://accounts.spotify.com/api/token',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Basic ${credentials}`,

          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
          grant_type:
            'refresh_token',

          refresh_token:
            refreshToken,
        }),
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException(
        'Spotify 인증 갱신에 실패했습니다. 다시 연결해주세요.',
      );
    }

    const tokens =
      (await response.json()) as SpotifyTokenResponse;

    const expiresAt = new Date(
      Date.now() +
        tokens.expires_in * 1000,
    );

    await this.prisma.spotifyAccount.update({
      where: {
        userId,
      },

      data: {
        accessToken:
          tokens.access_token,

        refreshToken:
          tokens.refresh_token ??
          refreshToken,

        expiresAt,
      },
    });

    return tokens.access_token;
  }
}