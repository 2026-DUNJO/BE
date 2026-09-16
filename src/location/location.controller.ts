import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard.js';

import { UpdateLocationDto } from './dto/update-location.dto.js';
import { LocationService } from './location.service.js';

@Controller('users/me/location')
export class LocationController {
  constructor(
    private readonly locationService: LocationService,
  ) {}

  @UseGuards(AuthGuard)
  @Put()
  updateLocation(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationService.updateLocation(
      request.user.sub,
      dto,
    );
  }

  @UseGuards(AuthGuard)
  @Get('nearby')
  findNearbyUsers(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.locationService.findNearbyUsers(
      request.user.sub,
    );
  }
}