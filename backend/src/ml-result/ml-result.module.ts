import { Module } from '@nestjs/common';
import { MlResultService } from './ml-result.service';
import { MlResultController } from './ml-result.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [MlResultService],
  controllers: [MlResultController],
})
export class MlResultModule {}