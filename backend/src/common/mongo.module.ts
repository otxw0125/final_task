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
        const uri = cs.get<string>('MONGODB_URI'); // <--- 여기를 수정!
        if (!uri) { // uri가 없는 경우 에러 처리 추가
          throw new Error('MongoDB URI (MONGODB_URI) is not defined in your environment variables.');
        }
        console.log('Attempting to connect to MongoDB with URI:', uri); // 디버깅 로그 추가
        const client = new MongoClient(uri); // non-null assertion operator (!) 제거, 위에서 undefined 체크
        await client.connect();
        console.log('MongoDB client connected successfully.'); // 연결 성공 로그 추가
        return client;
      },
      inject: [ConfigService],
    },
    <Provider>{
      provide: MONGO_DB,
      useFactory: (client: MongoClient, cs: ConfigService) => {
        const dbName = cs.get<string>('MONGO_DB_NAME') || 'test';
        console.log('Using database:', dbName); // 디버깅 로그 추가
        return client.db(dbName);
      },
      inject: [MONGO_CLIENT, ConfigService],
    },
  ],
  exports: [MONGO_DB], // MONGO_CLIENT도 export 할 수 있습니다. 필요에 따라
})
export class MongoModule {}