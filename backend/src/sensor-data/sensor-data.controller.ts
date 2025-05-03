// src/sensor-data/sensor-data.controller.ts (예시)
import { Controller, Post, Body, UsePipes, ValidationPipe, Req /*, UseGuards */ } from '@nestjs/common';
import { SensorDataService } from './sensor-data.service';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';
// import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'; // 인증 가드 예시
import { Request } from 'express'; // Express Request 객체 타입

@Controller('api/sensor-data') // 라우트 경로 접두사
export class SensorDataController {
  constructor(private readonly sensorDataService: SensorDataService) {}

  @Post()
  // @UseGuards(AuthenticatedGuard) // 필요시 인증된 사용자만 요청 가능하도록 가드 적용
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) // 파이프 적용 (main.ts 전역 설정 시 생략 가능)
  async createSensorData(
    @Body() createSensorDataDto: CreateSensorDataDto,
    // @Req() req: Request // 인증된 사용자 정보를 req 객체에서 가져올 경우
  ) {
    // userId는 여기서 req.user 등에서 가져와 서비스에 넘겨주는 것이 더 일반적
    // const userId = req.user?.id; // Passport 세션 사용 시 예시
    // if (!userId) { throw new UnauthorizedException(); }

    // ValidationPipe가 통과하면 createSensorDataDto는 유효성이 검증된 상태
    // 서비스 계층으로 DTO 전달 (userId도 필요시 함께 전달)
    // return this.sensorDataService.create(userId, createSensorDataDto); // 서비스 메소드 시그니처 변경 필요
    return this.sensorDataService.create(createSensorDataDto); // 현재 서비스 시그니처 기준
  }

  // 다른 GET 라우트 등...
}