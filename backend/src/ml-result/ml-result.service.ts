import { Injectable, OnModuleInit } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MlResultService implements OnModuleInit {
  private collection: Collection;
  
  constructor(private dbService: DatabaseService) {
    // 생성자에서 데이터베이스 접근 코드 제거
  }

  // 모듈 초기화 시 컬렉션 설정
  async onModuleInit() {
    const db = this.dbService.getDb();
    this.collection = db.collection('mlResults');
  }

  async create(userId: string, result: any) {
    return this.collection.insertOne({ userId: new ObjectId(userId), ...result, createdAt: new Date() });
  }

  async getByUser(userId: string, limit = 10) {
    return this.collection.find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).limit(limit).toArray();
  }
}