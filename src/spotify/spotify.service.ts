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

@Injectable()
export class SpotifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createLoginUrl(userId: number) {
    const state = await this.jwtService.signAsync(
      {
        sub: userId,
        purpose: 'spotify-oauth',
      },
      {
        expiresIn: '10m',
      },
    );

    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      scope: 'user-read-currently-playing user-read-playback-state',
      state,
    });

    return {
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    };
  }

  async handleCallback(code: string, state: string) {
    if (!code || !state) {
      throw new BadRequestException(
        'Spotify 인증 정보가 올바르지 않습니다.',
      );
    }

    let userId: number;

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        purpose: string;
      }>(state);

      if (payload.purpose !== 'spotify-oauth') {
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
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
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

    const profileResponse = await fetch(
      'https://api.spotify.com/v1/me',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
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
      Date.now() + tokens.expires_in * 1000,
    );

    const existingAccount =
      await this.prisma.spotifyAccount.findUnique({
        where: {
          userId,
        },
      });

    if (existingAccount) {
      await this.prisma.spotifyAccount.update({
        where: {
          userId,
        },
        data: {
          spotifyUserId: profile.id,
          accessToken: tokens.access_token,
          refreshToken:
            tokens.refresh_token ?? existingAccount.refreshToken,
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
          spotifyUserId: profile.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
        },
      });
    }

    return {
      connected: true,
      spotifyUserId: profile.id,
      displayName: profile.display_name,
    };
  }
}