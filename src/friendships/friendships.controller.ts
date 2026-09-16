import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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

  // =========================================
  // 내 친구 목록 조회
  // =========================================
  @UseGuards(AuthGuard)
  @Get()
  async getMyFriends(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.friendshipsService.getMyFriends(
      request.user.sub,
    );
  }

  // =========================================
  // 친구 끊기
  // =========================================
  @UseGuards(AuthGuard)
  @Delete(':id')
  async deleteFriendship(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) friendshipId: number,
  ) {
    return this.friendshipsService.deleteFriendship(
      request.user.sub,
      friendshipId,
    );
  }
}