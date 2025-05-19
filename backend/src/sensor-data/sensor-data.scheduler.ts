// src/sensor-data/sensor-data.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval, SchedulerRegistry } from '@nestjs/schedule';
import { SensorDataService } from './sensor-data.service';

@Injectable()
export class SensorDataScheduler {
  private readonly logger = new Logger(SensorDataScheduler.name);
  private emptyCount = 0;

  constructor(
    private readonly svc: SensorDataService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  // ↓ name과 주기를 뒤바꿔서 넘겨야 합니다.
  @Interval('sensorDataInterval', 300)
  async handle() {
    const result = await this.svc.processNewData();
    if (result.processed === 0) {
      this.emptyCount++;
      this.logger.debug(`No new raw data (${this.emptyCount}/5)`);
      if (this.emptyCount >= 5) {
        this.logger.warn('Stopping scheduler after 5 empty runs.');
        this.scheduler.deleteInterval('sensorDataInterval');
      }
    } else {
      this.emptyCount = 0;
      // 수정: processed -> result.processed
      this.logger.log(`Processed ${result.processed} raw records.`);
    }
  }
}