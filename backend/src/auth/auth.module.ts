// src/auth/auth.module.ts (예시)
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; // UsersService를 사용하기 위해 import
import { PassportModule } from '@nestjs/passport'; // Passport 사용 시 import

@Module({
  imports: [
    UsersModule, // UsersService를 주입받기 위해 필요
    PassportModule, // Passport 사용 시 필요
    // 다른 필요한 모듈 (예: JwtModule)
  ],
  controllers: [AuthController],
  providers: [AuthService /*, LocalStrategy, SessionSerializer 등 */],
})
export class AuthModule {}