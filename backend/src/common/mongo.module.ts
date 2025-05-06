// src/common/mongo.module.ts
import { Module, Global, Provider } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { MongoClient, Db } from 'mongodb';

const MONGO_CLIENT = 'MONGO_CLIENT';
const MONGO_DB     = 'MONGO_DB';

@Global()
@Module({
  imports: [ConfigModule],      // ConfigModule.forRoot({ isGlobal: true })를 AppModule에서 이미 등록했다고 가정
  providers: [
    <Provider>{
      provide: MONGO_CLIENT,
      useFactory: async (cs: ConfigService) => {
        const uri = cs.get<string>('MONGO_URI');
        const client = new MongoClient(uri!);
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    <Provider>{
      provide: MONGO_DB,
      useFactory: (client: MongoClient, cs: ConfigService) => {
        const dbName = cs.get<string>('MONGO_DB_NAME') || 'test';
        return client.db(dbName);
      },
      inject: [MONGO_CLIENT, ConfigService],
    },
  ],
  exports: [MONGO_DB],
})
export class MongoModule {}  // ← 반드시 export 해 줘야 모듈로 인식됩니다.