import { Test, TestingModule } from '@nestjs/testing';
import { MlResultsController } from './ml-results.controller';

describe('MlResultsController', () => {
  let controller: MlResultsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MlResultsController],
    }).compile();

    controller = module.get<MlResultsController>(MlResultsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
