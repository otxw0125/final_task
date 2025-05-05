import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    // MongoModule이 @Global() 으로 선언되어 있으면 따로 imports 불필요
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // AuthModule 등에서 재사용 가능
})
export class UsersModule {}