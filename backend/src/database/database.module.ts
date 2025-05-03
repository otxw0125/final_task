// src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoClient, Db } from 'mongodb'; // mongodb 드라이버 import
import { DATABASE_CONNECTION, DATABASE_NAME } from './database.constants';

@Global() // 모듈을 전역으로 만들어 다른 모듈에서 DatabaseModule을 import하지 않아도 프로바이더 사용 가능
@Module({
  imports: [ConfigModule], // ConfigService를 사용하기 위해 import
  providers: [
    {
      provide: DATABASE_CONNECTION, // 주입 토큰
      useFactory: async (configService: ConfigService): Promise<Db> => {
        try {
          const uri = configService.get<string>('MONGODB_URI');
          const dbName = configService.get<string>('DB_NAME', 'ProjectDB'); // .env 또는 기본값

          const client = await MongoClient.connect(uri); // URI 사용하여 연결

          console.log('MongoDB Native Driver Connected Successfully.'); // 연결 성공 로그

          // 앱 종료 시 연결 해제 리스너 (선택 사항이지만 권장)
          process.on('SIGINT', async () => {
              await client.close();
              console.log('MongoDB connection closed due to app termination');
              process.exit(0);
          });

          return client.db(dbName); // Db 객체 반환
        } catch (e) {
          console.error('MongoDB Native Driver Connection Error:', e);
          throw e; // 연결 실패 시 에러 발생
        }
      },
      inject: [ConfigService], // useFactory에 ConfigService 주입
    },
    // (선택 사항) DB 이름을 별도로 주입할 수도 있음
    // {
    //   provide: DATABASE_NAME,
    //   useFactory: (configService: ConfigService): string => {
    //       return configService.get<string>('DB_NAME', 'ProjectDB');
    //   },
    //   inject: [ConfigService],
    // }
  ],
  exports: [DATABASE_CONNECTION], // 다른 모듈에서 Db 객체를 주입받을 수 있도록 토큰 export
})
export class DatabaseModule {}