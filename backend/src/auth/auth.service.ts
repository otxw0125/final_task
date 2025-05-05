import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  // 회원가입: DTO로 받은 비밀번호 해시화 후 저장
  async signup(dto: CreateUserDto) {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(dto.password, salt);
    const user = await this.usersService.create({
      ...dto,
      password: hash,
    });
    const { password, ...rest } = user;
    return rest;
  }

  // passport-local 전략에서 호출
  async validateUser(username: string, password: string): Promise<any> {
    // 1) 사용자 조회
    const user = await this.usersService.findOneByUsername(username);
    if (!user) throw new UnauthorizedException();

    // 2) 비밀번호 검증
    const matched = await bcrypt.compare(password, user.password);
    if (!matched) throw new UnauthorizedException();

    // 3) password 제거 후 반환
    const { password: _, ...result } = user;
    return result;
  }

  // TODO: JWT 발급, 소셜 로그인 처리 등 추가 메서드
}