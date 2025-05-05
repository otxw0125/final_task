import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { UsersService } from '../users/users.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  serializeUser(user: any, done: Function) {
    // 세션에 저장할 key (여기서는 username)
    done(null, user.username);
  }

  async deserializeUser(username: string, done: Function) {
    // 세션에서 꺼낸 username으로 전체 프로필 조회
    const user = await this.usersService.findOneByUsername(username);
    if (!user) return done(new Error('User not found'), null);
    const { password, ...rest } = user;
    done(null, rest);
  }
}