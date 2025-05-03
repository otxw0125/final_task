// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // ValidationPipe import
// express-session, passport 등 다른 미들웨어 import 필요

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 ValidationPipe 설정
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // DTO에 정의되지 않은 속성 자동 제거
    forbidNonWhitelisted: true, // DTO에 정의되지 않은 속성이 들어오면 요청 거부
    transform: true, // 요청 데이터를 DTO 타입으로 자동 변환 (예: 경로 파라미터 문자열 -> 숫자)
    transformOptions: {
      enableImplicitConversion: true, // 암시적 타입 변환 허용
    },
  }));

  // 여기에 session, passport 미들웨어 설정 추가 필요
  // app.use(session({...}));
  // app.use(passport.initialize());
  // app.use(passport.session());

  await app.listen(3000); // 또는 process.env.PORT 사용
}
bootstrap();