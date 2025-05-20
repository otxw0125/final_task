import { TestingModule, Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import * as session from 'express-session';
import * as passport from 'passport';

/**
 * 테스트 애플리케이션을 초기화하는 도우미 함수
 */
export async function initializeTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  
  // 세션 설정
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000, // 1시간
      },
    }),
  );
  
  // 패스포트 설정
  app.use(passport.initialize());
  app.use(passport.session());
  
  // 유효성 검사 파이프 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  await app.init();
  return app;
}

/**
 * 테스트 데이터베이스를 초기화하는 도우미 함수
 * 주의: 실제 구현은 프로젝트의 데이터베이스 설정에 따라 달라질 수 있습니다.
 */
export async function cleanTestDatabase(app: INestApplication): Promise<void> {
  // 여기에서는 예시로 MongoDB를 사용한다고 가정합니다.
  // MongoDB의 연결을 가져와 컬렉션을 모두 비웁니다.
  const dbService = app.get('DatabaseService');
  
  // 주의: 실제 서비스에 맞게 수정해야 합니다.
  // 아래는 예시 코드입니다.
  /*
  await dbService.getCollection('users').deleteMany({});
  await dbService.getCollection('sensorData').deleteMany({});
  await dbService.getCollection('mlResults').deleteMany({});
  */
}

/**
 * 테스트 환경의 구성 옵션
 */
export const testConfig = {
  // 테스트 환경에서 사용할 데이터베이스 주소 (메인과 분리)
  databaseUri: 'mongodb://localhost:27017/test_db',
  
  // JWT 비밀키 (테스트용)
  jwtSecret: 'test-jwt-secret',
  
  // 테스트 유저 정보
  testUser: {
    username: 'test_user',
    password: 'Test123!',
  },
};