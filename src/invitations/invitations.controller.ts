import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard.js';

import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService:
      InvitationsService,
  ) {}

  // =========================================
  // 초대장 보내기
  // =========================================

  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(
      request.user.sub,
      dto,
    );
  }

  // =========================================
  // 받은 초대장
  // =========================================

  @UseGuards(AuthGuard)
  @Get('received')
  async getReceived(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.invitationsService.getReceived(
      request.user.sub,
    );
  }

  // =========================================
  // 보낸 초대장
  // =========================================

  @UseGuards(AuthGuard)
  @Get('sent')
  async getSent(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.invitationsService.getSent(
      request.user.sub,
    );
  }

  // =========================================
  // 초대장 상세 조회
  // =========================================

  @UseGuards(AuthGuard)
  @Get(':id')
  async getOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe)
    invitationId: number,
  ) {
    return this.invitationsService.getOne(
      request.user.sub,
      invitationId,
    );
  }

  // =========================================
  // 초대 거절
  // =========================================

  @UseGuards(AuthGuard)
  @Post(':id/reject')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe)
    invitationId: number,
  ) {
    return this.invitationsService.reject(
      request.user.sub,
      invitationId,
    );
  }

  // =========================================
  // 초대 수락
  // =========================================

  @UseGuards(AuthGuard)
  @Post(':id/accept')
  async accept(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe)
    invitationId: number,
  ) {
    return this.invitationsService.accept(
      request.user.sub,
      invitationId,
    );
  }
}