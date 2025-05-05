import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SensorDataModule } from './sensor-data/sensor-data.module';
import { MlResultsModule } from './ml-results/ml-results.module';
import { CommonModule } from './common/config.module';

@Module({
  imports: [
    // 환경변수 로딩
    ConfigModule.forRoot({ isGlobal: true }),

    // 기능별 모듈
    AuthModule,
    UsersModule,
    SensorDataModule,
    MlResultsModule,

    // 공통 유틸 모듈
    CommonModule,
  ],
})
export class AppModule {}
