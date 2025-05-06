import { Module } from '@nestjs/common';
import { MlResultsService } from './ml-results.service';
import { MlResultsController } from './ml-results.controller';

@Module({
  providers: [MlResultsService],
  controllers: [MlResultsController],
  exports: [MlResultsService],
})
export class MlResultsModule {}