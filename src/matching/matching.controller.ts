import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { MatchingService } from './matching.service.js';

@Controller('matching')
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
  ) {}

  @Post('test')
  testSimilarity(
    @Body()
    body: {
      myDNA: {
        energy: number;
        dreaminess: number;
        confidence: number;
        darkness: number;
        danceability: number;
        moodTags: string[];
      };

      otherDNA: {
        energy: number;
        dreaminess: number;
        confidence: number;
        darkness: number;
        danceability: number;
        moodTags: string[];
      };
    },
  ) {
    return this.matchingService.calculateSimilarity(
      body.myDNA,
      body.otherDNA,
    );
  }
}