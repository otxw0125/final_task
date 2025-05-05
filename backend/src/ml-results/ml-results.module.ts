import { Module } from '@nestjs/common';
import { MlResultsController } from './ml-results.controller';
import { MlResultsService } from './ml-results.service';

@Module({
  controllers: [MlResultsController],
  providers: [MlResultsService]
})
export class MlResultsModule {}
