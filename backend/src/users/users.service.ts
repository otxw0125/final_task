import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Db, WithId, Document, ObjectId } from 'mongodb';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly collection = 'users';

  constructor(
    @Inject('MONGO_DB') private readonly db: Db,  // MongoModule에서 제공하는 token
  ) {}

  /**
   * AuthService.signup()에서 호출되는 유저 생성 메서드
   */
  async create(dto: CreateUserDto): Promise<WithId<Document>> {
    const result = await this.db.collection<CreateUserDto>(this.collection).insertOne(dto);
    // MongoDB 드라이버 4.x에서는 result.insertedId 사용
    return this.findOne(result.insertedId.toHexString());
  }

  /** 전체 사용자 목록 조회 */
  async findAll(): Promise<WithId<Document>[]> {
    return this.db.collection(this.collection).find().toArray();
  }

  /** ID로 단일 사용자 조회 */
  async findOne(id: string): Promise<WithId<Document>> {
    const objId = new ObjectId(id);
    const user = await this.db.collection(this.collection).findOne({ _id: objId });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /** username으로 단일 사용자 조회 (로그인/세션) */
  async findOneByUsername(username: string): Promise<WithId<Document> | null> {
    return this.db.collection(this.collection).findOne({ username });
  }

  /** ID로 사용자 정보 업데이트 */
  async update(id: string, dto: UpdateUserDto): Promise<WithId<Document>> {
    const objId = new ObjectId(id);
    await this.db.collection(this.collection).updateOne({ _id: objId }, { $set: dto });
    return this.findOne(id);
  }

  /** ID로 사용자 삭제 */
  async remove(id: string): Promise<void> {
    const objId = new ObjectId(id);
    const { deletedCount } = await this.db.collection(this.collection).deleteOne({ _id: objId });
    if (deletedCount === 0) throw new NotFoundException(`User ${id} not found`);
  }
  // TODO: 이메일 중복 확인, 비밀번호 재설정, 권한 관리 메서드 추가
}