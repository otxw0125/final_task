// src/auth/auth.controller.ts
import {
    Controller,
    Post,
    Body,
    UseGuards, // UseGuards import
    Req,       // Req import
    HttpCode,  // HttpCode import
    HttpStatus // HttpStatus import
  } from '@nestjs/common';
  import { AuthService } from './auth.service';
  import { CreateUserDto } from '../users/dto/create-user.dto';
  import { LocalAuthGuard } from './guards/local-auth.guard'; // LocalAuthGuard import (경로 확인)
  import { Request } from 'express'; // Express Request 타입 import
@Controller('auth') // '/auth' 경로 접두사
export class AuthController {
  // AuthService를 주입받아 사용
  constructor(private readonly authService: AuthService) {}

  // POST /auth/signup 요청을 처리할 메소드 추가
  @Post('signup')
  // DTO 유효성 검사를 위해 ValidationPipe 적용 (main.ts에서 전역 설정했다면 생략 가능)
  // @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async signup(@Body() createUserDto: CreateUserDto) {
    // @Body() 데코레이터와 CreateUserDto를 사용하여 요청 본문을 받고 유효성 검사 수행
    // 실제 회원가입 로직은 AuthService의 메소드를 호출하여 처리
    return this.authService.signup(createUserDto);
  }
   // --- POST /auth/login 요청을 처리할 메소드 추가 ---
   @UseGuards(LocalAuthGuard) // ★ LocalAuthGuard를 사용하여 인증 수행
   @Post('login')
   @HttpCode(HttpStatus.OK) // 성공 시 상태 코드 200 OK 반환 명시 (기본값은 POST시 201)
   async login(@Req() req: Request) {
     // LocalAuthGuard가 성공적으로 실행되면 req.user에 인증된 사용자 정보가 담겨 있음
     // Passport가 세션 설정도 자동으로 처리 (SessionSerializer 설정 시)
     // 따라서 이 핸들러는 보통 req.user 정보만 반환해주면 됨
     return req.user;
   }
 

  // 여기에 /login, /logout 등의 다른 라우트 핸들러 추가 가능
  // 예시:
  // @Post('login')
  // async login(@Body() loginDto: LoginDto) { ... }
}