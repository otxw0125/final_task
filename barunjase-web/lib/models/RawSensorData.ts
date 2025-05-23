import { ObjectId } from 'mongodb';

/**
 * RawSensorData 인터페이스 - 원본 센서 데이터 모델 정의
 * 
 * 가속도계(accelerometer)로부터 직접 수신한 데이터 구조
 */
export interface RawSensorValues {
  x_accel: number;
  y_accel: number;
  z_accel: number;
}

export interface RawSensorData {
  _id?: ObjectId; // MongoDB 자동 생성 ID
  number?: number; // 데이터 식별 번호 (unique 예정)
  userId?: string; // 사용자 ID (선택적)
  sensor_values: RawSensorValues; // x_accel, y_accel, z_accel 포함
  timestamp: Date | string; // 데이터 수신 시간
  processedToAngle?: boolean; // AngleData로 변환되었는지 여부 플래그
  createdAt?: Date;
  updatedAt?: Date;
}

export const RawSensorDataCollection = 'rawsensordata';

/**
 * 새로운 원본 센서 데이터 객체 생성 (헬퍼 함수)
 */
export function createRawSensorData(
  accelValues: RawSensorValues,
  dataNumber?: number,
  userId?: string,
  timestampInput?: Date | string
): Omit<RawSensorData, '_id'> { // _id는 DB에서 자동 생성되므로 제외
  const now = new Date();
  return {
    number: dataNumber,
    userId: userId,
    sensor_values: accelValues,
    timestamp: timestampInput || now,
    processedToAngle: false, // 기본값은 false
    createdAt: now,
    updatedAt: now,
  };
}

// DB 조회 후 _id가 문자열로 변환된 상태를 위한 타입
export interface RawSensorDataWithId extends Omit<RawSensorData, '_id'> {
  _id: string;
}