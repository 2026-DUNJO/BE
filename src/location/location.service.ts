import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';

@Injectable()
export class LocationService {
  // DUNJO 최대 매칭 반경: 1km
  private readonly MAX_DISTANCE_KM = 1;

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async updateLocation(
    userId: number,
    dto: UpdateLocationDto,
  ) {
    const location =
      await this.prisma.userLocation.upsert({
        where: {
          userId,
        },

        update: {
          latitude: dto.latitude,
          longitude: dto.longitude,
        },

        create: {
          userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      updatedAt: location.updatedAt,
    };
  }

  async findNearbyUsers(userId: number) {
    // 1. 내 위치 조회
    const myLocation =
      await this.prisma.userLocation.findUnique({
        where: {
          userId,
        },
      });

    if (!myLocation) {
      return [];
    }

    // 2. 나를 제외하고 위치가 등록된 사용자 조회
    const otherLocations =
      await this.prisma.userLocation.findMany({
        where: {
          userId: {
            not: userId,
          },
        },

        include: {
          user: {
            select: {
              id: true,
              userId: true,
              nickname: true,
            },
          },
        },
      });

    // 3. 나와 다른 사용자의 거리 계산
    const nearbyUsers = otherLocations
      .map((location) => {
        const distanceKm =
          this.calculateDistance(
            myLocation.latitude,
            myLocation.longitude,
            location.latitude,
            location.longitude,
          );

        return {
          id: location.user.id,
          userId: location.user.userId,
          nickname: location.user.nickname,

          distanceKm: Number(
            distanceKm.toFixed(3),
          ),
        };
      })

      // 4. 1km 이하만 통과
      .filter(
        (user) =>
          user.distanceKm <=
          this.MAX_DISTANCE_KM,
      )

      // 5. 가까운 사용자부터 정렬
      .sort(
        (a, b) =>
          a.distanceKm - b.distanceKm,
      );

    return nearbyUsers;
  }

  private calculateDistance(
    latitude1: number,
    longitude1: number,
    latitude2: number,
    longitude2: number,
  ) {
    const EARTH_RADIUS_KM = 6371;

    const latDifference =
      this.toRadians(latitude2 - latitude1);

    const lonDifference =
      this.toRadians(longitude2 - longitude1);

    const lat1 =
      this.toRadians(latitude1);

    const lat2 =
      this.toRadians(latitude2);

    const a =
      Math.sin(latDifference / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(lonDifference / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a),
      );

    return EARTH_RADIUS_KM * c;
  }

  private toRadians(degrees: number) {
    return degrees * (Math.PI / 180);
  }
}