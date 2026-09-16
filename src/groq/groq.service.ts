import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import Groq from 'groq-sdk';

export interface MusicDNA {
  energy: number;
  dreaminess: number;
  confidence: number;
  darkness: number;
  danceability: number;
  moodTags: string[];
}

// =========================================
// DUNJO 매칭 결과에서 Groq에게 전달할 연결 정보
// =========================================

export interface MatchConnection {
  myTrack: {
    title: string;
    artist: string;
  };

  otherTrack: {
    title: string;
    artist: string;
  };

  match: number;

  connectionType:
    | 'SAME_TRACK'
    | 'LASTFM_SIMILAR';
}

// =========================================
// MatchSuccess 프론트에서 사용할 AI 데이터
// =========================================

export interface MatchAIResult {
  musicDNA: string[];
  matchReason: string;
}

@Injectable()
export class GroqService {
  private readonly groq: Groq;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GROQ_API_KEY가 설정되지 않았습니다.',
      );
    }

    this.groq = new Groq({
      apiKey,
    });
  }

  // =========================================
  // 기존 단일 곡 Music DNA 분석
  // =========================================

  async analyzeMusic(
    title: string,
    artist: string,
    tags: string[],
    similarTracks: {
      title: string;
      artist: string;
      match: number;
    }[],
  ): Promise<MusicDNA> {
    try {
      const completion =
        await this.groq.chat.completions.create({
          model: 'openai/gpt-oss-20b',

          messages: [
            {
              role: 'system',
              content: `
You analyze music for DUNJO,
a music-based social matching service.

Use the supplied metadata to describe the
musical characteristics of a track.

Do not invent factual metadata about the song.
              `.trim(),
            },

            {
              role: 'user',
              content: `
Track: ${title}
Artist: ${artist}

Last.fm tags:
${tags.join(', ') || 'No tags available'}

Similar tracks:
${
  similarTracks
    .slice(0, 5)
    .map(
      (track) =>
        `${track.artist} - ${track.title} (${track.match})`,
    )
    .join('\n') || 'No similar tracks available'
}

Evaluate:

energy: 0-100
dreaminess: 0-100
confidence: 0-100
darkness: 0-100
danceability: 0-100

Also return exactly 3 short mood tags.
              `.trim(),
            },
          ],

          temperature: 0.2,

          response_format: {
            type: 'json_schema',

            json_schema: {
              name: 'music_dna',
              strict: true,

              schema: {
                type: 'object',

                properties: {
                  energy: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                  },

                  dreaminess: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                  },

                  confidence: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                  },

                  darkness: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                  },

                  danceability: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                  },

                  moodTags: {
                    type: 'array',
                    minItems: 3,
                    maxItems: 3,

                    items: {
                      type: 'string',
                    },
                  },
                },

                required: [
                  'energy',
                  'dreaminess',
                  'confidence',
                  'darkness',
                  'danceability',
                  'moodTags',
                ],

                additionalProperties: false,
              },
            },
          },
        });

      const content =
        completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error(
          'Groq 응답이 비어 있습니다.',
        );
      }

      return JSON.parse(content) as MusicDNA;
    } catch (error) {
      console.error(
        'Groq Music DNA Error:',
        error,
      );

      throw new BadRequestException(
        'AI Music DNA 분석에 실패했습니다.',
      );
    }
  }

  // =========================================
  // 매칭 성공 후 AI Music DNA 생성
  //
  // ★ 매칭 판단에는 절대 사용하지 않음
  // ★ similarity >= 70 이후에만 호출
  // =========================================

  async generateMatchAI(
    similarity: number,
    coverage: number,
    strength: number,
    connections: MatchConnection[],
  ): Promise<MatchAIResult> {
    try {
      // ---------------------------------------
      // Groq에게 전달할 실제 연결 정보
      // ---------------------------------------

      const connectionText =
        connections
          .slice(0, 5)
          .map(
            (
              connection,
              index,
            ) => {
              const type =
                connection.connectionType ===
                'SAME_TRACK'
                  ? 'SAME TRACK'
                  : 'LAST.FM SIMILAR TRACK';

              return `
Connection ${index + 1}

My track:
${connection.myTrack.artist} - ${connection.myTrack.title}

Other user's track:
${connection.otherTrack.artist} - ${connection.otherTrack.title}

Type:
${type}

Last.fm / connection strength:
${connection.match}
              `.trim();
            },
          )
          .join('\n\n');

      const completion =
        await this.groq.chat.completions.create({
          model: 'openai/gpt-oss-20b',

          messages: [
            {
              role: 'system',

              content: `
You generate the AI MUSIC DNA section
for DUNJO's match success screen.

DUNJO is a music-based social matching
service.

IMPORTANT:

The users have ALREADY been matched by
DUNJO's algorithm.

You do NOT determine whether they match.
You do NOT calculate or modify their score.

Your job is only to summarize the musical
connection between the two users using the
provided track connection data.

Never invent:
- songs
- artists
- genres
- listening history
- musical facts

that cannot reasonably be supported by the
provided data.

Return:

1. musicDNA
Exactly 3 short English tags.

The tags should describe the shared musical
connection or listening tendency.

Examples of the desired STYLE:
HIGH ENERGY
K-POP
DANCE
DARK MOOD
BOLD
DREAMY
BAND SOUND
SAME ARTIST
SHARED TRACK

Do not blindly copy these examples.
Choose tags appropriate to the supplied data.

Each tag should:
- be short
- be uppercase
- contain at most 3 words
- work well as a small UI badge

2. matchReason

Write one short Korean sentence explaining
why the users' recent listening histories connected.

Use concrete artist or track names when useful.

Only describe what can be observed from the supplied
recent listening and connection data.

Prefer expressions such as:
- "최근 재생 기록에서"
- "함께 발견됐어요"
- "취향의 접점이 보여요"

Do not claim that a user "likes", "prefers",
or "frequently listens to" an artist or track
unless the supplied data explicitly proves it.
              `.trim(),
            },

            {
              role: 'user',

              content: `
DUNJO Match Data

Similarity:
${similarity}

Coverage:
${coverage}%

Strength:
${strength}%

Track connections:

${connectionText}

Generate the AI MUSIC DNA information
for the match success screen.
              `.trim(),
            },
          ],

          temperature: 0.3,

          response_format: {
            type: 'json_schema',

            json_schema: {
              name: 'dunjo_match_ai',

              strict: true,

              schema: {
                type: 'object',

                properties: {
                  musicDNA: {
                    type: 'array',

                    minItems: 3,
                    maxItems: 3,

                    items: {
                      type: 'string',
                    },
                  },

                  matchReason: {
                    type: 'string',
                  },
                },

                required: [
                  'musicDNA',
                  'matchReason',
                ],

                additionalProperties: false,
              },
            },
          },
        });

      const content =
        completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error(
          'Groq 매칭 AI 응답이 비어 있습니다.',
        );
      }

      return JSON.parse(
        content,
      ) as MatchAIResult;
    } catch (error) {
      console.error(
        'Groq Match AI Error:',
        error,
      );

      throw new BadRequestException(
        'AI 매칭 분석에 실패했습니다.',
      );
    }
  }
}