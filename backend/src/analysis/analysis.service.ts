import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { DatabaseService } from '../database/database.service';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../config/config.service';
import { ObjectId } from 'mongodb';

@Injectable()
export class AnalysisService {
  constructor(
    private http: HttpService,
    private config: ConfigService,
    private db: DatabaseService
  ) {}

  async analyze(userId: string) {
    const db = this.db.getDb();
    const readings = await db.collection('rawSensorData').find({ userId: new ObjectId(userId) }).toArray();
    const url = this.config.get('ML_SERVER_URL') + '/predict';
    const response = await firstValueFrom(this.http.post(url, readings));
    return response.data;
  }
}