import { Injectable, OnModuleInit } from '@nestjs/common';
import { Db, Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SensorDataService implements OnModuleInit {
  private rawCollection: Collection;
  private angleCollection: Collection;

  

  constructor(private dbService: DatabaseService) {
  }
  // 컬렉션을 비동기적으로 초기화하는 메서드 추가
  async onModuleInit() {
    const db = this.dbService.getDb();
    this.rawCollection = db.collection('rawSensorData');
    this.angleCollection = db.collection('angleData');
  }

  async createRaw(userId: string, data: { x: number; y: number; z: number; timestamp: Date }) {
    return this.rawCollection.insertOne({ userId: new ObjectId(userId), ...data });
  }

  async getLatestRaw(userId: string, limit = 10) {
    return this.rawCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async createAngle(userId: string, angleData: { roll: number; pitch: number; yaw: number; timestamp: Date }) {
    return this.angleCollection.insertOne({ userId: new ObjectId(userId), ...angleData });
  }

  // 추가: processNewData 메서드
  async processNewData() {
    // 최신 원시 데이터 가져오기 (처리되지 않은 데이터)
    const unprocessedData = await this.rawCollection
      .find({ processed: { $ne: true } })
      .sort({ timestamp: 1 })
      .limit(100)
      .toArray();
    
    if (unprocessedData.length === 0) {
      return { processed: 0, results: [] };
    }
    
    // 여기에 센서 데이터 처리 로직 추가
    // 예: 가속도 데이터를 각도로 변환
    const results = [];
    
    for (const data of unprocessedData) {
      // 예제 처리 로직 (실제 애플리케이션에 맞게 수정 필요)
      if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
        // 간단한 각도 계산 (실제 알고리즘은 더 복잡할 수 있음)
        const roll = Math.atan2(data.y, data.z) * (180/Math.PI);
        const pitch = Math.atan2(-data.x, Math.sqrt(data.y * data.y + data.z * data.z)) * (180/Math.PI);
        const yaw = 0; // 요(yaw)는 자이로스코프가 필요하므로 여기서는 계산하지 않음
        
        // 각도 데이터 저장
        await this.createAngle(data.userId.toString(), {
          roll,
          pitch,
          yaw,
          timestamp: data.timestamp
        });
        
        // 처리된 데이터 표시
        await this.rawCollection.updateOne(
          { _id: data._id },
          { $set: { processed: true } }
        );
        type ProcessedResult = {
  id: ObjectId;
  roll: number;
  pitch: number;
  yaw: number;
};
const results: ProcessedResult[] = [];
        results.push({ id: data._id, roll, pitch, yaw });
      }
    }
    
    return { processed: unprocessedData.length, results };
  }
}