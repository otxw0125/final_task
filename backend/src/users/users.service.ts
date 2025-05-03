// src/users/users.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb'; // Db, ObjectId import
import { DATABASE_CONNECTION } from '../database/database.constants'; // 주입 토큰 import
import { CreateUserDto } from './dto/create-user.dto'; // DTO는 그대로 사용 가능
import * as bcrypt from 'bcrypt'; // bcrypt import

@Injectable()
export class UsersService {
  // Mongoose Model 대신 Db 객체 주입
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Db) {}

  async create(createUserDto: CreateUserDto): Promise<any> {
    const { username, email, password } = createUserDto;

    // 비밀번호 해싱 (bcrypt 사용)
    const saltRounds = 10; // 솔트 라운드 수
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = {
      username,
      email,
      password: hashedPassword, // 해싱된 비밀번호 저장
      // uniqueKey는 필요시 DTO에 추가
      createdAt: new Date(), // 생성 시간 추가 (선택 사항)
    };

    // 기본 드라이버 방식으로 변경: collection().insertOne()
    const result = await this.db.collection('users').insertOne(newUser);
    console.log('User created with ID:', result.insertedId);
    // 삽입된 문서 정보나 ID 반환 등 필요에 맞게 수정
    return { id: result.insertedId, username, email };
  }

  async findOneByUsername(username: string): Promise<any | null> {
    // 기본 드라이버 방식으로 변경: collection().findOne()
    return this.db.collection('users').findOne({ username });
  }

  async findOneById(id: string): Promise<any | null> {
    if (!ObjectId.isValid(id)) {
        return null; // 유효하지 않은 ID 형식 처리
    }
    // 기본 드라이버 방식으로 변경: ObjectId 사용
    return this.db.collection('users').findOne({ _id: new ObjectId(id) });
  }

  // 다른 필요한 메소드들도 기본 드라이버 방식으로 수정...
}