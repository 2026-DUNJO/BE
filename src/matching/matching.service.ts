import { Injectable } from '@nestjs/common';

interface MusicDNA {
  energy: number;
  dreaminess: number;
  confidence: number;
  darkness: number;
  danceability: number;
  moodTags: string[];
}

@Injectable()
export class MatchingService {
  calculateSimilarity(
    myDNA: MusicDNA,
    otherDNA: MusicDNA,
  ) {
    const features: (keyof Omit<MusicDNA, 'moodTags'>)[] = [
      'energy',
      'dreaminess',
      'confidence',
      'darkness',
      'danceability',
    ];

    // 각 특성의 차이 계산
    const differences = features.map((feature) =>
      Math.abs(myDNA[feature] - otherDNA[feature]),
    );

    // 평균 차이
    const averageDifference =
      differences.reduce(
        (sum, difference) => sum + difference,
        0,
      ) / differences.length;

    // 차이가 0이면 100%, 차이가 100이면 0%
    const numericSimilarity =
      100 - averageDifference;

    // 공통 mood tag
    const commonTags = myDNA.moodTags.filter(
      (tag) =>
        otherDNA.moodTags.some(
          (otherTag) =>
            otherTag.toLowerCase() ===
            tag.toLowerCase(),
        ),
    );

    // 태그 하나당 +3점, 최대 +9점
    const tagBonus = commonTags.length * 3;

    const similarity = Math.min(
      100,
      Math.round(
        numericSimilarity + tagBonus,
      ),
    );

    return {
      similarity,
      commonTags,

      details: {
        energy:
          100 -
          Math.abs(
            myDNA.energy - otherDNA.energy,
          ),

        dreaminess:
          100 -
          Math.abs(
            myDNA.dreaminess -
              otherDNA.dreaminess,
          ),

        confidence:
          100 -
          Math.abs(
            myDNA.confidence -
              otherDNA.confidence,
          ),

        darkness:
          100 -
          Math.abs(
            myDNA.darkness -
              otherDNA.darkness,
          ),

        danceability:
          100 -
          Math.abs(
            myDNA.danceability -
              otherDNA.danceability,
          ),
      },
    };
  }
}