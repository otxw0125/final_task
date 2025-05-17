import { Injectable } from '@nestjs/common';
import { Db, Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private collection: Collection;
  constructor(private dbService: DatabaseService) {
    this.collection = this.dbService.getDb().collection('users');
  }

  async create(username: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);
    const result = await this.collection.insertOne({ username, password: hashed, createdAt: new Date() });
    return result.ops[0];
  }

  async findByUsername(username: string) {
    return this.collection.findOne({ username });
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: new ObjectId(id) });
  }
}
