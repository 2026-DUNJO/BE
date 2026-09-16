import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { userId, password, nickname } = signupDto;

    const existingUser = await this.prisma.user.findUnique({
      where: {
        userId,
      },
    });

    if (existingUser) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }

    const passwordHash = await argon2.hash(password);

    const user = await this.prisma.user.create({
      data: {
        userId,
        passwordHash,
        nickname,
      },
      select: {
        id: true,
        userId: true,
        nickname: true,
        createdAt: true,
      },
    });

    return user;
  }

  async login(loginDto: LoginDto) {
    const { userId, password } = loginDto;

    // 1. 아이디로 사용자 찾기
    const user = await this.prisma.user.findUnique({
      where: {
        userId,
      },
    });

    // 2. 존재하지 않는 사용자
    if (!user) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 3. 입력한 비밀번호와 저장된 hash 비교
    const passwordMatches = await argon2.verify(
      user.passwordHash,
      password,
    );

    // 4. 비밀번호 불일치
    if (!passwordMatches) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 5. JWT 생성
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      userId: user.userId,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '7d',
      user: {
        id: user.id,
        userId: user.userId,
        nickname: user.nickname,
      },
    };
  }
}