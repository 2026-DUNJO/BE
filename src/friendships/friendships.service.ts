import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FriendshipsService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================
  // 내 친구 목록 조회
  // =========================================
  async getMyFriends(userId: number) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            userId: true,
            nickname: true,
          },
        },
        user2: {
          select: {
            id: true,
            userId: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const result = await Promise.all(
      friendships.map(async (friendship) => {
        const friend =
          friendship.user1Id === userId
            ? friendship.user2
            : friendship.user1;

        const chatRoom =
          await this.prisma.chatRoom.findUnique({
            where: {
              user1Id_user2Id: {
                user1Id: friendship.user1Id,
                user2Id: friendship.user2Id,
              },
            },
          });

        return {
          friendshipId: friendship.id,
          friend,
          chatRoomId: chatRoom?.id ?? null,
          friendsSince: friendship.createdAt,
        };
      }),
    );

    return result;
  }

  // =========================================
  // 친구 관계 삭제
  // =========================================
  async deleteFriendship(
    userId: number,
    friendshipId: number,
  ) {
    // 1. 친구 관계 찾기
    const friendship =
      await this.prisma.friendship.findUnique({
        where: {
          id: friendshipId,
        },
      });

    if (!friendship) {
      throw new NotFoundException(
        '친구 관계를 찾을 수 없습니다.',
      );
    }

    // 2. 실제 친구 당사자인지 확인
    const isMember =
      friendship.user1Id === userId ||
      friendship.user2Id === userId;

    if (!isMember) {
      throw new BadRequestException(
        '이 친구 관계를 삭제할 권한이 없습니다.',
      );
    }

    // 3. 두 사람의 채팅방 찾기
    const chatRoom =
      await this.prisma.chatRoom.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id: friendship.user1Id,
            user2Id: friendship.user2Id,
          },
        },
      });

    // =========================================
    // 4. Transaction
    // ChatRoom 삭제 → SongMessage Cascade 삭제
    // Friendship 삭제
    // =========================================
    await this.prisma.$transaction(
      async (tx) => {
        if (chatRoom) {
          await tx.chatRoom.delete({
            where: {
              id: chatRoom.id,
            },
          });
        }

        await tx.friendship.delete({
          where: {
            id: friendshipId,
          },
        });
      },
    );

    return {
      message:
        '친구 관계와 채팅 기록이 삭제되었습니다.',
    };
  }
}