// src/sensor-data/sensor-data.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { DATABASE_CONNECTION } from '../database/database.constants';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto'; // DTO 정의 필요

@Injectable()
export class SensorDataService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Db) {}

  async create(createSensorDataDto: CreateSensorDataDto): Promise<any> {
    // DTO에서 데이터 추출 (userId, accel 등)
    const sensorDataToSave = {
      ...createSensorDataDto,
      timestamp: new Date(),
    };
    const result = await this.db.collection('sensorData').insertOne(sensorDataToSave);
    return result;
  }

  async findByUserId(userId: string, limit: number = 500): Promise<any[]> {
    // 특정 사용자의 데이터를 최신순으로 가져오기
    return this.db.collection('sensorData')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    // 필요시 reverse() 등 추가 처리
  }

  // 다른 필요한 메소드들...
}