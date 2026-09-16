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

import { ChatService } from './chat.service.js';
import { SendSongMessageDto } from './dto/send-song-message.dto.js';

@Controller('chatrooms')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @UseGuards(AuthGuard)
  @Post(':id/messages')
  async sendSong(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) chatRoomId: number,
    @Body() dto: SendSongMessageDto,
  ) {
    return this.chatService.sendSong(
      request.user.sub,
      chatRoomId,
      dto,
    );
  }

  @UseGuards(AuthGuard)
  @Get(':id/messages')
  async getMessages(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) chatRoomId: number,
  ) {
    return this.chatService.getMessages(
      request.user.sub,
      chatRoomId,
    );
  }
}