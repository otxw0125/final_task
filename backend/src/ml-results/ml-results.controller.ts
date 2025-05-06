import { Controller, Post, Get, Body, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { MlResultsService } from './ml-results.service';
import { CreateMlResultDto } from './dto/create-ml-result.dto';

@Controller('ml-results')
export class MlResultsController {
  constructor(private readonly mlResultsService: MlResultsService) {}

  /** POST /ml-results: ML 서버 결과 저장 */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() dto: CreateMlResultDto) {
    return this.mlResultsService.create(dto);
  }

  /** GET /ml-results: 전체 ML 결과 조회 */
  @Get()
  async findAll() {
    return this.mlResultsService.findAll();
  }

  /** GET /ml-results/:sensorId: 특정 센서 결과 조회 */
  @Get(':sensorId')
  async findBySensor(@Param('sensorId') sensorId: string) {
    return this.mlResultsService.findBySensor(sensorId);
  }
}