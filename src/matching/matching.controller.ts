import {
  Controller,
} from '@nestjs/common';

import { MatchingService } from './matching.service.js';

@Controller('matching')
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
  ) {}
}