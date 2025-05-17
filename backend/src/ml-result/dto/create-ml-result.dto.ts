// src/ml-results/dto/create-ml-result.dto.ts
import { IsString, IsISO8601 } from 'class-validator';

export class CreateMlResultDto {
  @IsString()
  // 연관된 센서 데이터 ID
  sensorId: string;

  @IsString()
  // ML 서버로부터 받은 분석 결과 JSON 문자열
  resultPayload: string;

  @IsISO8601()
  // 분석된 시점 (ISO 8601 문자열)
  timestamp: string;
}