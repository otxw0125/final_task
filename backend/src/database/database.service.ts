import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient;
  private db: Db;

  constructor(private configService: ConfigService) {
    const uri = this.configService.get('MONGODB_URI');
    this.client = new MongoClient(uri);
  }

  async onModuleInit() {
    await this.client.connect();
    this.db = this.client.db(this.configService.get('MONGODB_DB'));
  }

  getDb(): Db {
    return this.db;
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
