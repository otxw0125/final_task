// src/sensor-data/dto/create-sensor-data.dto.ts

import { Type } from 'class-transformer'; // 타입 변환을 위해 필요
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  ValidateNested, // 중첩 객체 유효성 검사를 위해 필요
} from 'class-validator';

// 중첩된 accel 객체의 타입을 정의하고 유효성을 검사하기 위한 클래스
class AccelDto {
  @IsNumber({}, { message: '가속도 X값은 숫자여야 합니다.' })
  @IsNotEmpty({ message: '가속도 X값은 필수입니다.' })
  x: number;

  @IsNumber({}, { message: '가속도 Y값은 숫자여야 합니다.' })
  @IsNotEmpty({ message: '가속도 Y값은 필수입니다.' })
  y: number;

  @IsNumber({}, { message: '가속도 Z값은 숫자여야 합니다.' })
  @IsNotEmpty({ message: '가속도 Z값은 필수입니다.' })
  z: number;
}

export class CreateSensorDataDto {
  // accel 필드는 객체 형태여야 함
  @IsObject({ message: 'accel 필드는 객체여야 합니다.' })
  @IsNotEmpty({ message: 'accel 데이터는 필수입니다.' })
  @ValidateNested() // 중첩된 AccelDto 객체의 유효성도 검사
  @Type(() => AccelDto) // 요청 데이터를 AccelDto 타입으로 변환 시도
  accel: AccelDto;

  // userId는 컨트롤러에서 요청(request) 객체나 다른 방법으로 얻어와
  // 서비스 계층에서 추가하는 것이 더 일반적일 수 있습니다.
  // 만약 요청 본문에 userId도 포함되어야 한다면 여기에 추가하고 데코레이터 적용
  // @IsString()
  // @IsNotEmpty()
  // userId: string;
}