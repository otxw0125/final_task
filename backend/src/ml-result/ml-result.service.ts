import { Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MlResultService {
  private collection: Collection;
  constructor(private dbService: DatabaseService) {
    this.collection = this.dbService.getDb().collection('mlResults');
  }

  async create(userId: string, result: any) {
    return this.collection.insertOne({ userId: new ObjectId(userId), ...result, createdAt: new Date() });
  }

  async getByUser(userId: string, limit = 10) {
    return this.collection.find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).limit(limit).toArray();
  }
}
