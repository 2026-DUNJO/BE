import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

interface LastFmTrackInfo {
  track?: {
    name: string;
    artist: {
      name: string;
    };
    url: string;
    toptags?: {
      tag?: {
        name: string;
        url: string;
      }[];
    };
  };
  error?: number;
  message?: string;
}

interface LastFmSimilarTracks {
  similartracks?: {
    track?: {
      name: string;
      match: string;
      artist: {
        name: string;
      };
      url: string;
    }[];
  };
  error?: number;
  message?: string;
}

@Injectable()
export class LastfmService {
  private getApiKey() {
    const apiKey = process.env.LASTFM_API_KEY;

    if (!apiKey) {
      throw new BadRequestException(
        'LASTFM_API_KEY가 설정되지 않았습니다.',
      );
    }

    return apiKey;
  }

  async getTrackInfo(artist: string, track: string) {
    const params = new URLSearchParams({
      method: 'track.getInfo',
      api_key: this.getApiKey(),
      artist,
      track,
      format: 'json',
      autocorrect: '1',
    });

    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'DUNJO/1.0',
        },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Last.fm API 요청에 실패했습니다.',
      );
    }

    const data =
      (await response.json()) as LastFmTrackInfo;

    if (data.error || !data.track) {
      throw new BadRequestException(
        data.message ??
          'Last.fm에서 곡을 찾지 못했습니다.',
      );
    }

    return {
      title: data.track.name,
      artist: data.track.artist.name,

      tags:
        data.track.toptags?.tag
          ?.map((tag) => tag.name)
          .slice(0, 5) ?? [],

      lastfmUrl: data.track.url,
    };
  }

  async getSimilarTracks(
    artist: string,
    track: string,
  ) {
    const params = new URLSearchParams({
      method: 'track.getSimilar',
      api_key: this.getApiKey(),
      artist,
      track,
      format: 'json',
      autocorrect: '1',
      limit: '10',
    });

    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'DUNJO/1.0',
        },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Last.fm 유사곡 요청에 실패했습니다.',
      );
    }

    const data =
      (await response.json()) as LastFmSimilarTracks;

    if (data.error) {
      throw new BadRequestException(
        data.message ??
          'Last.fm 유사곡을 가져오지 못했습니다.',
      );
    }

    return (
      data.similartracks?.track?.map((item) => ({
        title: item.name,
        artist: item.artist.name,

        // Last.fm의 match 값은 문자열이라 숫자로 변환
        match: Number(item.match),

        lastfmUrl: item.url,
      })) ?? []
    );
  }
}