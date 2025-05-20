import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import * as session from 'express-session';
import * as passport from 'passport';
// Import Jest's expect function explicitly
import { expect, describe, it, beforeAll, afterAll } from '@jest/globals';

// Utility function to join cookie array into a string
const joinCookies = (cookies: string[]): string => cookies.join('; ');

describe('Auth Controller (e2e)', () => {
  let app: INestApplication;
  let authCookie: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      }),
    );
    app.use(passport.initialize());
    app.use(passport.session());
    
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);
  it('should complete the full auth flow: register → login → profile', async () => {
    // Step 1: Register a new user
    const testUser = {
      username: `test_user_${Date.now()}`,
      password: 'Password123!',
    };

    const registerResponse = await request(app.getHttpServer())
      .post('/users/register')
      .send(testUser)
      .expect(201);
    
    expect(registerResponse.body).toBeDefined();
    expect(registerResponse.body.username).toBe(testUser.username);
    
    // Step 2: Login with the registered user
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser)
      .expect(201);
    
    expect(loginResponse.body.status).toBe('ok');
    expect(loginResponse.body.user).toBeDefined();
    
    // Save authentication cookie
    const cookieHeader = loginResponse.headers['set-cookie'];
    expect(cookieHeader).toBeDefined();
    authCookie = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    expect(authCookie).toBeDefined();
    expect(authCookie.length).toBeGreaterThan(0);
    
    // Step 3: Access protected profile endpoint
    const profileResponse = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Cookie', joinCookies(authCookie))
      .expect(200);
    
    expect(profileResponse.body.authenticated).toBe(true);
    expect(profileResponse.body.user).toBeDefined();
  });
});
