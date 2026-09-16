import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    InvitationsController,
  ],

  providers: [
    InvitationsService,
  ],

  exports: [
    InvitationsService,
  ],
})
export class InvitationsModule {}