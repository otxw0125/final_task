// src/auth/auth.controller.ts
import { Controller, Post, Body, ValidationPipe, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service'; // AuthService import
import { CreateUserDto } from '../users/dto/create-user.dto'; // User DTO import (경로 확인)

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

  // 여기에 /login, /logout 등의 다른 라우트 핸들러 추가 가능
  // 예시:
  // @Post('login')
  // async login(@Body() loginDto: LoginDto) { ... }
}