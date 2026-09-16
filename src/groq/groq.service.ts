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
}