import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FriendshipsService {
  constructor(private readonly prisma: PrismaService) {}

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
}