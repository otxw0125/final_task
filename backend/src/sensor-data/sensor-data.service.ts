import { Injectable } from '@nestjs/common';
import { Db, Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SensorDataService {
  private rawCollection: Collection;
  private angleCollection: Collection;

  constructor(private dbService: DatabaseService) {
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
}