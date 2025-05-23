import { ObjectId } from 'mongodb';

/**
 * AngleData 인터페이스 - 자세 각도 데이터 모델 정의
 * 
 * 가속도 센서 데이터로부터 계산된 각도 정보를 저장하는 구조
 */
export interface AnglesValues {
  x: number;
  y: number;
  z: number;
}

export interface AngleData {
  _id?: any;
  sensorDataNumber?: number;
  userId?: string;
  angles: AnglesValues;
  timestamp: Date | string;
  
  // generatePostureFeedbackFromAngleData 결과 저장
  overallScore?: number;
  riskLevel?: 'safe' | 'warning' | 'danger' | 'unknown';
  summaryMessage?: string;
  detailedAdvice?: string[];
  // feedbackPerAxis?: any; // 필요하다면 이것도 저장 가능하나, 데이터가 커질 수 있음

  // 기존 filtered, scoreData 필드는 일단 유지하거나, 점진적으로 제거 고려
  filtered?: AnglesValues;
  scoreData?: {
    score: number;
    category: 'good' | 'moderate' | 'poor';
    continuousDuration: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export const AngleDataCollection = 'angledata';

// DB 조회 후 _id가 문자열로 변환된 상태를 위한 타입
export interface AngleDataWithId extends Omit<AngleData, '_id'> {
  _id: string;
}

/**
 * 새로운 각도 데이터 객체 생성
 */
export function createAngleData(
  sensorDataNumberInput: number,
  xAngle: number,
  yAngle: number,
  zAngle: number,
  xFiltered: number = 0,
  yFiltered: number = 0,
  zFiltered: number = 0,
  score: number = 75,
  timestamp: Date = new Date()
): AngleData {
  let category: 'good' | 'moderate' | 'poor';
  if (score >= 80) {
    category = 'good';
  } else if (score >= 60) {
    category = 'moderate';
  } else {
    category = 'poor';
  }

  const now = new Date();
  
  return {
    sensorDataNumber: sensorDataNumberInput,
    timestamp,
    angles: {
      x: xAngle,
      y: yAngle,
      z: zAngle
    },
    filtered: {
      x: xFiltered,
      y: yFiltered,
      z: zFiltered
    },
    scoreData: {
      score,
      category,
      continuousDuration: 0
    },
    createdAt: now,
    updatedAt: now
  };
}