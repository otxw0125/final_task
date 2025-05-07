// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongoModule } from './common/mongo.module';  // 경로·이름 확인
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SensorDataModule } from './sensor-data/sensor-data.module';
import { MlResultsModule } from './ml-results/ml-results.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),  // .env를 먼저 로드
    MongoModule,
    AuthModule,
    UsersModule,
    SensorDataModule,
    MlResultsModule,
    CommonModule,
  ],
})
export class AppModule {}
