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

    // 같은 상대에게 이미 보낸
    // 대기 중 초대장이 있는지 확인
    const existingInvitation =
      await this.prisma.invitation.findFirst({
        where: {
          senderId,
          receiverId: dto.receiverId,
          status: 'PENDING',
        },
      });

    if (existingInvitation) {
      throw new ConflictException(
        '이미 대기 중인 초대장이 있습니다.',
      );
    }

    const invitation =
      await this.prisma.invitation.create({
        data: {
          senderId,
          receiverId: dto.receiverId,

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

    return invitation;
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
    // 기존 reject 코드
    // ...
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

    if (invitation.receiverId !== userId) {
      throw new BadRequestException(
        '이 초대장을 수락할 권한이 없습니다.',
      );
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        '이미 처리된 초대장입니다.',
      );
    }

    const user1Id = Math.min(
      invitation.senderId,
      invitation.receiverId,
    );

    const user2Id = Math.max(
      invitation.senderId,
      invitation.receiverId,
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
            invitation: acceptedInvitation,
            friendship,
            chatRoom,
          };
        },
      );

    return {
      message: '친구 초대장을 수락했습니다.',
      invitationId: result.invitation.id,
      friendshipId: result.friendship.id,
      chatRoomId: result.chatRoom.id,
    };
  }
} // ← InvitationsService 끝
