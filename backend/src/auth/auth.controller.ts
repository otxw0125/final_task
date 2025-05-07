import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    Get,
    Res,
    HttpStatus,
  } from '@nestjs/common';
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
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(@Request() req) {
      // req.user가 SessionSerializer에 의해 session에 저장됨
      return { status: 'ok', user: req.user };
    }
  
    // 3) 로그아웃
    @Post('logout')
    async logout(@Request() req, @Res() res) {
      req.logout(() => {
        // 세션 파괴 후 응답
        res.status(HttpStatus.OK).json({ status: 'logged out' });
      });
    }
  
    // 4) 로그인 상태 확인 / 프로필 조회
    @Get('profile')
    getProfile(@Request() req) {
      if (!req.isAuthenticated()) {
        return { authenticated: false };
      }
      return { authenticated: true, user: req.user };
    }
  
    // TODO: 비밀번호 재설정, 이메일 인증, 소셜 로그인 등 추가 엔드포인트
  }