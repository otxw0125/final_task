// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { MongooseModule } from '@nestjs/mongoose'; // MongooseModule 제거
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module'; // DatabaseModule import 추가
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SensorDataModule } from './sensor-data/sensor-data.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule, // DatabaseModule 추가 (MongoDB 연결 담당)
    // MongooseModule.forRootAsync({...}) 설정 제거

    // 기능 모듈들
    UsersModule,
    AuthModule,
    SensorDataModule,
    RealtimeModule,
    AnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}