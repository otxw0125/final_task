import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient;
  private db: Db;
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    const uri = this.configService.get('MONGODB_URI');
    this.client = new MongoClient(uri);
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.db = this.client.db(this.configService.get('MONGODB_DB'));
      this.isInitialized = true;
      console.log('데이터베이스 연결 성공');
    } catch (error) {
      console.error('데이터베이스 연결 실패:', error);
      throw error; // 앱 시작 시 연결 실패하면 중단
    }
  }

  getDb(): Db {
    if (!this.isInitialized || !this.db) {
      throw new Error('데이터베이스가 아직 초기화되지 않았습니다. onModuleInit이 완료될 때까지 기다려주세요.');
    }
    return this.db;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      this.isInitialized = false;
      console.log('데이터베이스 연결 종료');
    }
  }
}