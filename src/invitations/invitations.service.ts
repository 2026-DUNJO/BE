import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateInvitationDto } from './dto/create-invitation.dto.js';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =========================================
// 초대장 상세 조회
// =========================================

async getOne(
  userId: number,
  invitationId: number,
) {
  const invitation =
    await this.prisma.invitation.findUnique({
      where: {
        id: invitationId,
      },

      include: {
        sender: {
          select: {
            id: true,
            userId: true,
            nickname: true,
          },
        },

        receiver: {
          select: {
            id: true,
            userId: true,
            nickname: true,
          },
        },
      },
    });

  if (!invitation) {
    throw new NotFoundException(
      '초대장을 찾을 수 없습니다.',
    );
  }

  // 초대장을 보낸 사람 또는 받은 사람만 조회 가능
  if (
    invitation.senderId !== userId &&
    invitation.receiverId !== userId
  ) {
    throw new BadRequestException(
      '이 초대장을 조회할 권한이 없습니다.',
    );
  }

  return invitation;
}

  // =========================================
  // 초대장 보내기
  // =========================================

  async create(
    senderId: number,
    dto: CreateInvitationDto,
  ) {
    if (senderId === dto.receiverId) {
      throw new BadRequestException(
        '자기 자신에게 초대장을 보낼 수 없습니다.',
      );
    }

    // -----------------------------------------
    // 1. 상대 사용자 존재 확인
    // -----------------------------------------

    const receiver =
      await this.prisma.user.findUnique({
        where: {
          id: dto.receiverId,
        },
      });

    if (!receiver) {
      throw new NotFoundException(
        '상대 사용자를 찾을 수 없습니다.',
      );
    }

    // -----------------------------------------
    // 2. 이미 친구인지 확인
    // -----------------------------------------

    const user1Id = Math.min(
      senderId,
      dto.receiverId,
    );

    const user2Id = Math.max(
      senderId,
      dto.receiverId,
    );

    const existingFriendship =
      await this.prisma.friendship.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id,
            user2Id,
          },
        },
      });

    if (existingFriendship) {
      throw new ConflictException(
        '이미 친구인 사용자입니다.',
      );
    }

    // -----------------------------------------
    // 3. 내가 이미 상대에게 보낸
    //    PENDING 초대장이 있는지 확인
    // -----------------------------------------

    const existingSentInvitation =
      await this.prisma.invitation.findFirst({
        where: {
          senderId,
          receiverId: dto.receiverId,
          status: 'PENDING',
        },
      });

    if (existingSentInvitation) {
      throw new ConflictException(
        '이미 대기 중인 초대장이 있습니다.',
      );
    }

    // -----------------------------------------
    // 4. 상대가 나에게 먼저 보낸
    //    PENDING 초대장이 있는지 확인
    //
    //    A → B가 존재하는 상태에서
    //    B → A도 보내려고 한다면
    //    서로 친구가 되고 싶다는 뜻이므로
    //    기존 초대를 바로 수락
    // -----------------------------------------

    const receivedInvitation =
      await this.prisma.invitation.findFirst({
        where: {
          senderId: dto.receiverId,
          receiverId: senderId,
          status: 'PENDING',
        },
      });

    if (receivedInvitation) {
      const result =
        await this.prisma.$transaction(
          async (tx) => {
            const friendship =
              await tx.friendship.create({
                data: {
                  user1Id,
                  user2Id,
                },
              });

            const chatRoom =
              await tx.chatRoom.create({
                data: {
                  user1Id,
                  user2Id,
                },
              });

            const acceptedInvitation =
              await tx.invitation.update({
                where: {
                  id: receivedInvitation.id,
                },

                data: {
                  status: 'ACCEPTED',
                },
              });

            return {
              invitation:
                acceptedInvitation,
              friendship,
              chatRoom,
            };
          },
        );

      return {
        mutualMatch: true,

        message:
          '서로 초대장을 보내 친구가 되었습니다.',

        invitationId:
          result.invitation.id,

        friendshipId:
          result.friendship.id,

        chatRoomId:
          result.chatRoom.id,
      };
    }

    // -----------------------------------------
    // 5. 아무 초대도 없다면
    //    새로운 PENDING 초대장 생성
    // -----------------------------------------

    const invitation =
      await this.prisma.invitation.create({
        data: {
          senderId,

          receiverId:
            dto.receiverId,

          spotifyTrackId:
            dto.spotifyTrackId,

          trackTitle:
            dto.trackTitle,

          trackArtist:
            dto.trackArtist,

          albumImage:
            dto.albumImage,

          spotifyUrl:
            dto.spotifyUrl,
        },

        include: {
          sender: {
            select: {
              id: true,
              userId: true,
              nickname: true,
            },
          },

          receiver: {
            select: {
              id: true,
              userId: true,
              nickname: true,
            },
          },
        },
      });

    return {
      mutualMatch: false,

      message:
        '친구 초대장을 보냈습니다.',

      invitation,
    };
  }

  // =========================================
  // 받은 초대장 조회
  // =========================================

  async getReceived(
    userId: number,
  ) {
    return this.prisma.invitation.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
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
        createdAt: 'desc',
      },
    });
  }

  // =========================================
  // 보낸 초대장 조회
  // =========================================

  async getSent(
    userId: number,
  ) {
    return this.prisma.invitation.findMany({
      where: {
        senderId: userId,
      },

      include: {
        receiver: {
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
  }

  // =========================================
  // 초대 거절
  // =========================================

  async reject(
    userId: number,
    invitationId: number,
  ) {
    const invitation =
      await this.prisma.invitation.findUnique({
        where: {
          id: invitationId,
        },
      });

    if (!invitation) {
      throw new NotFoundException(
        '초대장을 찾을 수 없습니다.',
      );
    }

    // 초대장을 받은 사람만 거절 가능
    if (
      invitation.receiverId !== userId
    ) {
      throw new BadRequestException(
        '이 초대장을 거절할 권한이 없습니다.',
      );
    }

    if (
      invitation.status !== 'PENDING'
    ) {
      throw new BadRequestException(
        '이미 처리된 초대장입니다.',
      );
    }

    const rejectedInvitation =
      await this.prisma.invitation.update({
        where: {
          id: invitationId,
        },

        data: {
          status: 'REJECTED',
        },
      });

    return {
      message:
        '친구 초대장을 거절했습니다.',

      invitationId:
        rejectedInvitation.id,
    };
  }

  // =========================================
  // 초대 수락
  // =========================================

  async accept(
    userId: number,
    invitationId: number,
  ) {
    const invitation =
      await this.prisma.invitation.findUnique({
        where: {
          id: invitationId,
        },
      });

    if (!invitation) {
      throw new NotFoundException(
        '초대장을 찾을 수 없습니다.',
      );
    }

    if (
      invitation.receiverId !== userId
    ) {
      throw new BadRequestException(
        '이 초대장을 수락할 권한이 없습니다.',
      );
    }

    if (
      invitation.status !== 'PENDING'
    ) {
      throw new BadRequestException(
        '이미 처리된 초대장입니다.',
      );
    }

    // -----------------------------------------
    // Friendship / ChatRoom은
    // 항상 작은 ID → user1
    // 큰 ID → user2
    // -----------------------------------------

    const user1Id = Math.min(
      invitation.senderId,
      invitation.receiverId,
    );

    const user2Id = Math.max(
      invitation.senderId,
      invitation.receiverId,
    );

    // -----------------------------------------
    // 이미 친구인지 확인
    // -----------------------------------------

    const existingFriendship =
      await this.prisma.friendship.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id,
            user2Id,
          },
        },
      });

    if (existingFriendship) {
      throw new ConflictException(
        '이미 친구인 사용자입니다.',
      );
    }

    // -----------------------------------------
    // Friendship + ChatRoom + Invitation
    // 한 번에 처리
    // -----------------------------------------

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const friendship =
            await tx.friendship.create({
              data: {
                user1Id,
                user2Id,
              },
            });

          const chatRoom =
            await tx.chatRoom.create({
              data: {
                user1Id,
                user2Id,
              },
            });

          const acceptedInvitation =
            await tx.invitation.update({
              where: {
                id: invitationId,
              },

              data: {
                status: 'ACCEPTED',
              },
            });

          return {
            invitation:
              acceptedInvitation,

            friendship,

            chatRoom,
          };
        },
      );

    return {
      message:
        '친구 초대장을 수락했습니다.',

      invitationId:
        result.invitation.id,

      friendshipId:
        result.friendship.id,

      chatRoomId:
        result.chatRoom.id,
    };
  }
}