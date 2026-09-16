import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { SendSongMessageDto } from './dto/send-song-message.dto.js';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // 해당 사용자가 이 채팅방의 멤버인지 확인
  private async getAuthorizedChatRoom(
    userId: number,
    chatRoomId: number,
  ) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: {
        id: chatRoomId,
      },
    });

    if (!chatRoom) {
      throw new NotFoundException(
        '채팅방을 찾을 수 없습니다.',
      );
    }

    const isMember =
      chatRoom.user1Id === userId ||
      chatRoom.user2Id === userId;

    if (!isMember) {
      throw new BadRequestException(
        '이 채팅방에 접근할 권한이 없습니다.',
      );
    }

    return chatRoom;
  }

  // 곡 던지기
  async sendSong(
    userId: number,
    chatRoomId: number,
    dto: SendSongMessageDto,
  ) {
    await this.getAuthorizedChatRoom(
      userId,
      chatRoomId,
    );

    return this.prisma.songMessage.create({
      data: {
        chatRoomId,
        senderId: userId,

        spotifyTrackId: dto.spotifyTrackId,
        trackTitle: dto.trackTitle,
        trackArtist: dto.trackArtist,
        albumImage: dto.albumImage,
        spotifyUrl: dto.spotifyUrl,
      },

      include: {
        sender: {
          select: {
            id: true,
            userId: true,
            nickname: true,
          },
        },
      },
    });
  }

  // 채팅 기록 조회
  async getMessages(
    userId: number,
    chatRoomId: number,
  ) {
    await this.getAuthorizedChatRoom(
      userId,
      chatRoomId,
    );

    return this.prisma.songMessage.findMany({
      where: {
        chatRoomId,
      },

      include: {
        sender: {
          select: {
            id: true,
            userId: true,
            nickname: true,
          },
        },
      },

      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}