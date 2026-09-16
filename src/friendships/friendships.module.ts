import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { FriendshipsController } from './friendships.controller.js';
import { FriendshipsService } from './friendships.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [FriendshipsController],
  providers: [FriendshipsService],
  exports: [FriendshipsService],
})
export class FriendshipsModule {}