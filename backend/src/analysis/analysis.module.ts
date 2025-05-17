import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [ConfigModule, DatabaseModule, CommonModule],
  providers: [AnalysisService],
  controllers: [AnalysisController],
})
export class AnalysisModule {}