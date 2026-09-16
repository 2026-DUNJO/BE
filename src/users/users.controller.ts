import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findMe(request.user.sub);
  }
}