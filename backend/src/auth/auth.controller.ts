import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Res,
  HttpStatus,
  Req,            // ← Request 데코레이터 대신 Req
} from '@nestjs/common';
import type { Request, Response } from 'express';  // ← Express Request/Response 타입
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';

  @Controller('auth')
  export class AuthController {
    constructor(private readonly authService: AuthService) {}
  
    // 1) 회원가입
    @Post('signup')
    async signup(@Body() dto: CreateUserDto) {
      const user = await this.authService.signup(dto);
      return { status: 'ok', user };
    }
  
    // 2) 로그인 (passport-local)
    @Post('login')
      async login(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
      ) {
        // Passport.authenticate → req.user 세팅된 상태
        // 세션에 저장하도록 req.logIn 호출
        await new Promise<void>((resolve, reject) => {
          req.logIn(req.user, err => {
            if (err) return reject(err);
            resolve();
          });
        });
        // 이제 express-session이 세션을 저장하고, Set-Cookie 헤더를 응답에 붙입니다.
        return { status: 'ok', user: req.user };
       }
  
    // 3) 로그아웃
    @Post('logout')
    async logout(@Req() req: Request, @Res() res: Response) {
      req.logout(err => {
        if (err) {
          return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: 'error' });
        }
        res.clearCookie('connect.sid');
        res.status(HttpStatus.OK).json({ status: 'logged out' });
      });
    }
  
    // 4) 로그인 상태 확인 / 프로필 조회
    @Get('profile')
    getProfile(@Req() req: Request) {
      if (!req.isAuthenticated()) {
        return { authenticated: false };
      }
      return { authenticated: true, user: req.user };
    }
  }
    // TODO: 비밀번호 재설정, 이메일 인증, 소셜 로그인 등 추가 엔드포인트