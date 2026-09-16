import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

interface JwtPayload {
  sub: number;
  userId: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      request.user = payload;

      return true;
    } catch {
      throw new UnauthorizedException(
        '유효하지 않거나 만료된 토큰입니다.',
      );
    }
  }

  private extractToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');

    return type === 'Bearer' ? token : undefined;
  }
}