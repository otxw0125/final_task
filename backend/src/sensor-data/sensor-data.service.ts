import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Db, WithId, Document } from 'mongodb';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';

type SensorRecord = {
  x: string;
  y: string;
  z: string;
  raw: string;
  timestamp: Date;
};

@Injectable()
export class SensorDataService {
  private readonly collectionName = 'sensor-data';
  private readonly coll;

  constructor(
    @Inject('MONGO_DB') private readonly db: Db,
  ) {
    this.coll = this.db.collection<SensorRecord>(this.collectionName);
  }

  /**
   * 문자열 콤마 구분 데이터를 파싱하여 숫자 배열로 반환
   */
  private parsePayload(payload: string): { x: number; y: number; z: number } {
    const parts = payload.split(',').map(p => p.trim());
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid payload format, expected "x,y,z"');
    }
    const [xStr, yStr, zStr] = parts;
    const x = parseFloat(xStr);
    const y = parseFloat(yStr);
    const z = parseFloat(zStr);
    if ([x, y, z].some(n => isNaN(n))) {
      throw new BadRequestException('Payload contains non-numeric values');
    }
    return { x, y, z };
  }

  /**
   * 센서 데이터 생성 및 저장
   */
  async create(dto: CreateSensorDataDto): Promise<WithId<Document & SensorRecord>> {
    const { x_accel, y_accel, z_accel, timestamp } = dto;
  
    const record: SensorRecord = {
      x: x_accel.toFixed(2),
      y: y_accel.toFixed(2),
      z: z_accel.toFixed(2),
      raw: `${x_accel.toFixed(2)},${y_accel.toFixed(2)},${z_accel.toFixed(2)}`,
      timestamp: new Date(timestamp),
    };
  
    const result = await this.coll.insertOne(record);
  
    // ✅ 저장 로그 출력
    console.log('[SensorDataService] Data inserted:', record);
  
    return this.coll.findOne({ _id: result.insertedId });
  }

  /**
   * 전체 센서 데이터 조회
   */
  async findAll(): Promise<WithId<Document & SensorRecord>[]> {
    return this.coll.find().sort({ timestamp: -1 }).toArray();
  }
}