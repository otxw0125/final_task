import { IsNumber } from 'class-validator';

export class CreateSensorDataDto {
  @IsNumber()
  x_accel: number;

  @IsNumber()
  y_accel: number;

  @IsNumber()
  z_accel: number;

  @IsNumber()
  timestamp: number;
}