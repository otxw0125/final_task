import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { UsersService } from '../users/users.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  serializeUser(user: any, done: Function) {
    done(null, user.username);
  }

  async deserializeUser(username: string, done: Function) {
    // 수정: findOneByUsername -> findByUsername
    const user = await this.usersService.findByUsername(username);
    if (!user) return done(new Error('User not found'), null);
    const { password, ...rest } = user;
    done(null, rest);
  }
}