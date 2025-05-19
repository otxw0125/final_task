import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // 추가: HttpModule 임포트
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    ConfigModule, 
    DatabaseModule, 
    CommonModule,
    HttpModule, // 추가: HttpModule 임포트
  ],
  providers: [AnalysisService],
  controllers: [AnalysisController],
})
export class AnalysisModule {}