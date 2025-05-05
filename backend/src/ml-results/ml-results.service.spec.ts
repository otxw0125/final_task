import { Test, TestingModule } from '@nestjs/testing';
import { MlResultsService } from './ml-results.service';

describe('MlResultsService', () => {
  let service: MlResultsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MlResultsService],
    }).compile();

    service = module.get<MlResultsService>(MlResultsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
