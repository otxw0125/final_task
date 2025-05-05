import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SensorDataController } from './sensor-data.controller';
import { SensorDataService } from './sensor-data.service';
import { SensorData, SensorDataSchema } from './schemas/sensor-data.schema';

@Module({
  imports: [
    // MongoDB 스키마 등록 (TypeORM 사용 시 TypeOrmModule.forFeature([...]) 로 대체)
    MongooseModule.forFeature([{ name: SensorData.name, schema: SensorDataSchema }]),
  ],
  controllers: [SensorDataController],
  providers: [SensorDataService],
  exports: [SensorDataService],
})
export class SensorDataModule {}