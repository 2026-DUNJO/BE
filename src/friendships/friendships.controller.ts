import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard.js';

import { FriendshipsService } from './friendships.service.js';

@Controller('friendships')
export class FriendshipsController {
  constructor(
    private readonly friendshipsService: FriendshipsService,
  ) {}

  @UseGuards(AuthGuard)
  @Get()
  async getMyFriends(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.friendshipsService.getMyFriends(
      request.user.sub,
    );
  }
}