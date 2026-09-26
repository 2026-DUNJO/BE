import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FriendshipsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =========================================
  // 내 친구 목록 조회
  // =========================================

  async getMyFriends(
    userId: number,
  ) {
    const friendships =
      await this.prisma.friendship.findMany({
        where: {
          OR: [
            {
              user1Id: userId,
            },
            {
              user2Id: userId,
            },
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

    const result =
      await Promise.all(
        friendships.map(
          async (friendship) => {
            // =================================
            // 상대방 정보
            // =================================

            const friend =
              friendship.user1Id ===
              userId
                ? friendship.user2
                : friendship.user1;

            // =================================
            // 채팅방 조회
            // =================================

            const chatRoom =
              await this.prisma.chatRoom.findUnique({
                where: {
                  user1Id_user2Id: {
                    user1Id:
                      friendship.user1Id,

                    user2Id:
                      friendship.user2Id,
                  },
                },
              });

            // 채팅방이 없는 경우
            if (!chatRoom) {
              return {
                friendshipId:
                  friendship.id,

                friend,

                chatRoomId: null,

                friendsSince:
                  friendship.createdAt,

                lastMessage: null,

                unreadCount: 0,
              };
            }

            // =================================
            // 마지막으로 주고받은 곡
            // =================================

            const lastMessage =
              await this.prisma.songMessage.findFirst({
                where: {
                  chatRoomId:
                    chatRoom.id,
                },

                orderBy: {
                  createdAt: 'desc',
                },

                select: {
                  id: true,

                  senderId: true,

                  spotifyTrackId:
                    true,

                  trackTitle: true,

                  trackArtist: true,

                  albumImage: true,

                  spotifyUrl: true,

                  readAt: true,

                  createdAt: true,
                },
              });

            // =================================
            // 내가 아직 안 읽은 곡 개수
            // =================================

            const unreadCount =
              await this.prisma.songMessage.count({
                where: {
                  chatRoomId:
                    chatRoom.id,

                  // 상대가 보낸 것만
                  senderId: {
                    not: userId,
                  },

                  // 아직 읽지 않음
                  readAt: null,
                },
              });

            return {
              friendshipId:
                friendship.id,

              friend,

              chatRoomId:
                chatRoom.id,

              friendsSince:
                friendship.createdAt,

              lastMessage,

              unreadCount,
            };
          },
        ),
      );

    return result;
  }

  // =========================================
  // 두 사용자가 이미 친구인지 확인
  // =========================================

  async areFriends(
    firstUserId: number,
    secondUserId: number,
  ): Promise<boolean> {
    const user1Id = Math.min(
      firstUserId,
      secondUserId,
    );

    const user2Id = Math.max(
      firstUserId,
      secondUserId,
    );

    const friendship =
      await this.prisma.friendship.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id,
            user2Id,
          },
        },

        select: {
          id: true,
        },
      });

    return !!friendship;
  }

  // =========================================
  // 친구 관계 삭제
  // =========================================

  async deleteFriendship(
    userId: number,
    friendshipId: number,
  ) {
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

    const isMember =
      friendship.user1Id === userId ||
      friendship.user2Id === userId;

    if (!isMember) {
      throw new BadRequestException(
        '이 친구 관계를 삭제할 권한이 없습니다.',
      );
    }

    const chatRoom =
      await this.prisma.chatRoom.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id:
              friendship.user1Id,

            user2Id:
              friendship.user2Id,
          },
        },
      });

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