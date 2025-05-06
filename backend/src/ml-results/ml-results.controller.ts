import { Controller, Post, Get, Body, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { MlResultsService } from './ml-results.service';
import { CreateMlResultDto } from './dto/create-ml-result.dto';

@Controller('ml-results')
export class MlResultsController {
  constructor(private readonly service: MlResultsService) {}

  /**
   * POST /ml-results
   * ML 서버로부터 결과를 받아 저장
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() dto: CreateMlResultDto) {
    return this.service.create(dto);
  }

  /**
   * GET /ml-results
   * 전체 결과 반환
   */
  @Get()
  async findAll() {
    return this.service.findAll();
  }

  /**
   * GET /ml-results/:sensorId
   * 특정 센서에 대한 결과 반환
   */
  @Get(':sensorId')
  async findBySensor(@Param('sensorId') sensorId: string) {
    return this.service.findBySensor(sensorId);
  }
}