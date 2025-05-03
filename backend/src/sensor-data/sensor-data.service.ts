// src/sensor-data/sensor-data.service.ts (DTO 사용 부분)
import { Injectable, Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { DATABASE_CONNECTION } from '../database/database.constants';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';

@Injectable()
export class SensorDataService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Db) {}

  // create 메소드는 이미 DTO를 타입으로 사용 중
  async create(createSensorDataDto: CreateSensorDataDto): Promise<any> {
    // DTO 객체에서 데이터 추출
    const sensorDataToSave = {
      // userId: userId, // 컨트롤러에서 받거나 다른 방식으로 설정
      accel: createSensorDataDto.accel, // DTO의 accel 객체 사용
      timestamp: new Date(),
    };
    // userId 추가 로직 필요 (예: 메소드 인자로 받기)
    // const sensorDataToSave = { userId, ...createSensorDataDto, timestamp: new Date() };

    const result = await this.db.collection('sensorData').insertOne(sensorDataToSave);
    console.log(`Saved sensor data for user ${/*userId*/ '...'} with accel:`, createSensorDataDto.accel);
    return result; // 또는 생성된 데이터 반환 등
  }

  // ... findByUserId 등 다른 메소드 ...
}