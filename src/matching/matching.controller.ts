import {
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard.js';

import { MatchingService } from './matching.service.js';

@Controller('matching')
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('search')
  async search(
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.matchingService.searchMatch(
      request.user.sub,
    );
  }
}