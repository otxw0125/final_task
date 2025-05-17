import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SensorDataModule } from './sensor-data/sensor-data.module';
import { MlResultModule } from './ml-result/ml-result.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AnalysisModule } from './analysis/analysis.module';
import { ReportModule } from './report/report.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CommonModule,
    AuthModule,
    UsersModule,
    SensorDataModule,
    MlResultModule,
    RealtimeModule,
    AnalysisModule,
    ReportModule,
  ],
})
export class AppModule {}
