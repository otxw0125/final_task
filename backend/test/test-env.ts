/**
 * 테스트 도우미 함수들을 모아놓은 파일입니다.
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

/**
 * 테스트 사용자를 생성하고 로그인하는 도우미 함수
 */
export async function createAndLoginUser(app: INestApplication, username: string = `test_${Date.now()}`) {
  const testUser = {
    username,
    password: 'Password123!',
  };

  // 1. 사용자 생성
  const signupRes = await request(app.getHttpServer())
    .post('/users/register')  // auth/signup 대신 users/register 사용
    .send(testUser);

  // 2. 로그인
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send(testUser);

  return {
    user: loginRes.body.user,
    authCookie: loginRes.headers['set-cookie'],
  };
}

/**
 * 센서 데이터를 생성하는 도우미 함수
 */
export async function createSensorData(app: INestApplication, authCookie: string, count: number = 1) {
  const results = [];

  // 인증 쿠키가 없는 경우 빈 배열 반환
  if (!authCookie) {
    console.log('Auth cookie is not set, skipping sensor data creation');
    return results;
  }

  for (let i = 0; i < count; i++) {
    const sensorData = {
      x: Math.random() * 2 - 1,  // -1 ~ 1 사이의 랜덤 값
      y: Math.random() * 2 - 1,
      z: Math.random() * 2 - 1,
      timestamp: new Date(Date.now() - i * 1000).toISOString(), // 1초 간격으로 과거 데이터 생성
    };

    try {
      const res = await request(app.getHttpServer())
        .post('/sensor-data/raw')
        .set('Cookie', authCookie)
        .send(sensorData);

      if (res.status === 201) {
        results.push(res.body);
      }
    } catch (error) {
      console.error('Error creating sensor data:', error);
    }
  }

  return results;
}

/**
 * ML 결과를 생성하는 도우미 함수
 */
export async function createMlResult(app: INestApplication, authCookie: string, result: string = 'normal') {
  // 인증 쿠키가 없는 경우 null 반환
  if (!authCookie) {
    console.log('Auth cookie is not set, skipping ML result creation');
    return null;
  }

  const mlData = {
    result,
    confidence: Math.random() * 0.5 + 0.5, // 0.5 ~ 1.0 사이의 랜덤 값
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await request(app.getHttpServer())
      .post('/ml-results')
      .set('Cookie', authCookie)
      .send(mlData);

    if (res.status === 201) {
      return res.body;
    }
  } catch (error) {
    console.error('Error creating ML result:', error);
  }

  return null;
}