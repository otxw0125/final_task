// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller'; // UsersController가 있다면 import
// DatabaseModule이나 MongooseModule.forFeature 등 필요한 import 추가

@Module({
  imports: [
    // 여기에 MongooseModule.forFeature(...) 또는 다른 필요한 모듈 import
  ],
  controllers: [UsersController], // UsersController가 있다면 포함
  providers: [UsersService],       // UsersService를 이 모듈의 provider로 등록
  exports: [UsersService]         // <--- 이 줄을 추가하세요!
                                  // UsersService를 다른 모듈(예: AuthModule)에서
                                  // 주입받아 사용할 수 있도록 내보냅니다.
})
export class UsersModule {}