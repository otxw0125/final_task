import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 회원가입: 비밀번호 해시 후 UsersService.create 호출
   */
  async signup(dto: CreateUserDto) {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(dto.password, salt);
    // 수정: UsersService.create 함수 호출 방식 변경
    const user = await this.usersService.create(dto.username, hash);
    const { password, ...rest } = user;
    return rest;
  }

  /**
   * passport-local 전략에서 사용자 검증 시 호출
   */
  async validateUser(username: string, password: string): Promise<any> {
    // 수정: findOneByUsername -> findByUsername
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException();
    const matched = await bcrypt.compare(password, user.password);
    if (!matched) throw new UnauthorizedException();
    const { password: _, ...rest } = user;
    return rest;
  }
  // TODO: JWT 발급, 소셜 로그인 등 추가
}