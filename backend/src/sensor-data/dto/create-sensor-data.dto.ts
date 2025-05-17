// src/sensor-data/dto/create-sensor-data.dto.ts
import { IsString, IsNumber } from 'class-validator';

export class CreateSensorDataDto {
  @IsString()
  username: string;       // 추가: 센서 데이터를 보낸 사용자

  @IsNumber()
  x_accel: number;

  @IsNumber()
  y_accel: number;

  @IsNumber()
  z_accel: number;

  @IsNumber()
  timestamp: number;      // 밀리초 단위 타임스탬프
}
