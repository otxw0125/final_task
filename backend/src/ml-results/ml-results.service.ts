- import { MlResultsService } from './ml-results.service';  // ← 이 줄 제거
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Db, WithId, Document, ObjectId } from 'mongodb';
import { CreateMlResultDto } from './dto/create-ml-result.dto';
type MlResultRecord = {
  sensorId: ObjectId;
  resultPayload: string;
  timestamp: Date;
};

@Injectable()
export class MlResultsService {
  private readonly collection = 'ml-results';

  constructor(
    @Inject('MONGO_DB') private readonly db: Db,
  ) {}

  /**
   * ML 분석 결과 저장
   */
  async create(dto: CreateMlResultDto): Promise<WithId<Document & MlResultRecord>> {
    const record: MlResultRecord = {
      sensorId: new ObjectId(dto.sensorId),
      resultPayload: dto.resultPayload,
      timestamp: new Date(dto.timestamp),
    };
    const { insertedId } = await this.db.collection<MlResultRecord>(this.collection).insertOne(record);
    return this.db.collection(this.collection).findOne({ _id: insertedId });
  }

  /**
   * 전체 ML 결과 조회
   */
  async findAll(): Promise<WithId<Document & MlResultRecord>[]> {
    return this.db.collection(this.collection).find().sort({ timestamp: -1 }).toArray();
  }

  /**
   * 특정 센서 ID에 대한 분석 결과 조회
   */
  async findBySensor(sensorId: string): Promise<WithId<Document & MlResultRecord>[]> {
    const objId = new ObjectId(sensorId);
    return this.db.collection(this.collection)
      .find({ sensorId: objId })
      .sort({ timestamp: -1 })
      .toArray();
  }

  /**
   * TODO: 개별 분석 결과 수정 및 삭제 메서드 추가
   */
}