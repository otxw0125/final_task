import { IsString } from 'class-validator';

export class CreateSensorDataDto {
  @IsString()
  // 가속도 센서 x,y,z 값을 콤마로 구분한 문자열, 예: "0.12,1.34,-0.56"
  payload: string;
}