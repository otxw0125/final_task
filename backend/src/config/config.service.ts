import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

@Injectable()
export class ConfigService {
  get(key: string): string {
    return process.env[key];
  }
}