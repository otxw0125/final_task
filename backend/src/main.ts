// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';

import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  // NestExpressApplication 타입 지정
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 전역 ValidationPipe
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // 1) 쿠키 파서
  app.use(cookieParser());

  // 2) 세션 설정 (secret은 안전한 문자열로 교체)
  app.use(session({
    secret: 'YOUR_SECRET_KEY',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 },  // 1시간
  }));

  // 3) Passport 초기화 & 세션 연동
  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(3000);
}
bootstrap();
