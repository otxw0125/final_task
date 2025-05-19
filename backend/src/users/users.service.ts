import { Injectable, OnModuleInit } from '@nestjs/common';
import { Db, Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
  private collection: Collection;
  
  constructor(private dbService: DatabaseService) {
    // 생성자에서 데이터베이스 접근 코드 제거
  }

  // 모듈 초기화 시 컬렉션 설정
  async onModuleInit() {
    const db = this.dbService.getDb();
    this.collection = db.collection('users');
  }

  async create(username: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = { username, password: hashed, createdAt: new Date() };
    
    // 수정: 최신 MongoDB 드라이버에 맞게 변경
    await this.collection.insertOne(newUser);
    return newUser; // 직접 생성한 객체를 반환
  }
  
  async findByUsername(username: string) {
    return this.collection.findOne({ username });
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: new ObjectId(id) });
  }
}