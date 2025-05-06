import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Db, WithId, ObjectId } from 'mongodb';
import { CreateMlResultDto } from './dto/create-ml-result.dto';

export interface MlResultRecord {
  _id?: ObjectId;
  sensorId: ObjectId;
  resultPayload: string;
  timestamp: Date;
}

@Injectable()
export class MlResultsService {
  private readonly collectionName = 'ml-results';

  constructor(@Inject('MONGO_DB') private readonly db: Db) {}

  private get collection() {
    return this.db.collection<MlResultRecord>(this.collectionName);
  }

  /** ML 분석 결과 저장 */
  async create(dto: CreateMlResultDto): Promise<WithId<MlResultRecord>> {
    const record: MlResultRecord = {
      sensorId: new ObjectId(dto.sensorId),
      resultPayload: dto.resultPayload,
      timestamp: new Date(dto.timestamp),
    };
    const result = await this.collection.insertOne(record);
    const inserted = await this.collection.findOne({ _id: result.insertedId });
    if (!inserted) throw new NotFoundException('Inserted ML result not found');
    return inserted;
  }

  /** 전체 ML 결과 조회 */
  async findAll(): Promise<WithId<MlResultRecord>[]> {
    return this.collection.find().sort({ timestamp: -1 }).toArray();
  }

  /** 특정 센서에 대한 분석 결과 조회 */
  async findBySensor(sensorId: string): Promise<WithId<MlResultRecord>[]> {
    const objId = new ObjectId(sensorId);
    return this.collection.find({ sensorId: objId }).sort({ timestamp: -1 }).toArray();
  }

  // TODO: 개별 ML 결과 수정 및 삭제 메서드 추가
}