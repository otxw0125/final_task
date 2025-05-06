import { Controller, Post, Get, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { SensorDataService } from './sensor-data.service';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';

@Controller('sensor-data')
export class SensorDataController {
  constructor(private readonly service: SensorDataService) {}

  /**
   * POST /sensor-data
   * payload 문자열을 받아 파싱 후 저장
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() dto: CreateSensorDataDto) {
    return this.service.create(dto);
  }

  /**
   * GET /sensor-data
   * 저장된 센서 데이터 전체 목록 반환
   */
  @Get()
  async findAll() {
    return this.service.findAll();
  }
}