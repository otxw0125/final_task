// src/auth/auth.service.ts (일부 예시)
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service'; // UsersService 주입 필요
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async signup(createUserDto: CreateUserDto) {
    // 여기에 사용자 이름/이메일 중복 체크 등의 로직 추가 가능
    const createdUser = await this.usersService.create(createUserDto);
    // password 등 민감 정보 제외하고 반환
    const { password, ...result } = createdUser;
    return result;
  }

  // 로그인 검증 로직 등 추가...
}