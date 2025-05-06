import { Module } from '@nestjs/common';
import { MlResultsService } from './ml-results.service';
import { MlResultsController } from './ml-results.controller';

@Module({
  controllers: [MlResultsController],
  providers: [MlResultsService],
  exports: [MlResultsService],
})
export class MlResultsModule {}