// src/common/config.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [
    // NestJS 공식 ConfigModule을 전역으로 등록
    NestConfigModule.forRoot({ isGlobal: true }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}  // 이 클래스명은 변경하지 않아도 됩니다.
