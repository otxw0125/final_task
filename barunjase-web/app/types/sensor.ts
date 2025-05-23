/**
 * 3축 가속도 데이터 인터페이스
 */
export interface Acceleration {
  x: number;
  y: number;
  z: number;
}

/**
 * 원시 센서 데이터 인터페이스
 */
export interface RawSensorData {
  _id?: string;
  number: number;
  accel: Acceleration;
  timestamp: string | Date;
  magnitude?: number;
}

/**
 * 각도 데이터 인터페이스
 */
export interface AngleData {
  X: number; // 피치 (목 기울기)
  Y: number; // 롤 (허리 기울기)
  Z: number; // 요 (몸 회전)
}

/**
 * 각도 데이터 응답 인터페이스
 */
export interface AngleDataResponse {
  _id: string;
  number: number;
  sensorDataNumber?: number;
  Angle: AngleData;
  scoreData?: {
    score: number;
    category: string;
  };
  timestamp: string;
}

/**
 * 자세 점수 인터페이스
 */
export interface PostureScore {
  score: number;
  category: 'good' | 'normal' | 'bad';
  timestamp: string | Date;
  angleData?: AngleData;
} 