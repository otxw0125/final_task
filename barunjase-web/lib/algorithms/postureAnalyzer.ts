import { AngleResult, isAngleWithinNormalRange, formatAngle } from './angleConverter';
import { PostureScore, createPostureScore } from '../models/PostureScore';

/**
 * AngleResult를 기반으로 PostureScore 객체 생성을 위한 상세 정보를 생성합니다.
 */
export interface PostureAnalysisResult {
  overallScore: number;
  riskLevel: 'safe' | 'warning' | 'danger';
  summaryMessage: string;
  detailedAdvice: string[];
  categoryScores: {
    neck: number; // X축 (피치)
    back: number; // Y축 (롤)
    rotation: number; // Z축 (요)
  };
}

const NORMAL_RANGES = {
  X: { min: -15, max: 15, name: '목(앞뒤 기울기)', goodScore: 35 }, // 피치 (목 앞뒤)
  Y: { min: -10, max: 10, name: '허리(좌우 기울기)', goodScore: 35 }, // 롤 (허리 좌우)
  Z: { min: -10, max: 10, name: '몸통(회전)', goodScore: 30 }, // 요 (몸 회전)
};

const SCORE_WEIGHTS = {
    X: 0.35, // 목
    Y: 0.35, // 허리
    Z: 0.30  // 몸통
};

/**
 * 각도에 따라 개별 축 점수를 계산합니다. (0-100점 척도)
 * @param angle 실제 각도
 * @param rangeInfo 해당 축의 정상 범위 및 정보
 * @returns 점수 (0-100)
 */
function calculateAxisScore(angle: number, rangeInfo: typeof NORMAL_RANGES.X): number {
  const { min, max } = rangeInfo;
  if (angle >= min && angle <= max) {
    return 100; // 정상 범위 내면 만점
  }
  // 범위를 벗어날수록 점수 급격히 감소 (예시 로직, 조정 가능)
  const deviation = Math.min(Math.abs(angle - min), Math.abs(angle - max));
  let score = 100 - deviation * 5; // 1도 벗어날 때마다 5점 감점
  return Math.max(0, Math.min(100, score)); // 0점 미만, 100점 초과 방지
}

/**
 * AngleResult를 분석하여 자세 점수 및 피드백을 생성합니다.
 * @param angles AngleResult 객체
 * @returns PostureAnalysisResult
 */
export function analyzePostureFromAngles(angles: AngleResult): PostureAnalysisResult {
  const advice: string[] = [];
  let totalWeightedScore = 0;

  const categoryScores = {
    neck: calculateAxisScore(angles.X, NORMAL_RANGES.X),
    back: calculateAxisScore(angles.Y, NORMAL_RANGES.Y),
    rotation: calculateAxisScore(angles.Z, NORMAL_RANGES.Z),
  };

  totalWeightedScore = 
      categoryScores.neck * SCORE_WEIGHTS.X +
      categoryScores.back * SCORE_WEIGHTS.Y +
      categoryScores.rotation * SCORE_WEIGHTS.Z;

  const overallScore = Math.round(totalWeightedScore);

  let riskLevel: 'safe' | 'warning' | 'danger';
  let summaryMessage: string;

  // X축 (목) 피드백
  if (angles.X < NORMAL_RANGES.X.min) {
    advice.push(`${NORMAL_RANGES.X.name}: 앞으로 너무 숙여져 있습니다. (현재: ${formatAngle(angles.X)}, 정상: ${formatAngle(NORMAL_RANGES.X.min)}~${formatAngle(NORMAL_RANGES.X.max)})`);
  } else if (angles.X > NORMAL_RANGES.X.max) {
    advice.push(`${NORMAL_RANGES.X.name}: 뒤로 너무 젖혀져 있습니다. (현재: ${formatAngle(angles.X)}, 정상: ${formatAngle(NORMAL_RANGES.X.min)}~${formatAngle(NORMAL_RANGES.X.max)})`);
  } else {
    advice.push(`${NORMAL_RANGES.X.name}: 좋은 자세입니다. (현재: ${formatAngle(angles.X)}, 정상: ${formatAngle(NORMAL_RANGES.X.min)}~${formatAngle(NORMAL_RANGES.X.max)})`);
  }

  // Y축 (허리) 피드백
  if (angles.Y < NORMAL_RANGES.Y.min) {
    advice.push(`${NORMAL_RANGES.Y.name}: 왼쪽으로 너무 기울어져 있습니다. (현재: ${formatAngle(angles.Y)}, 정상: ${formatAngle(NORMAL_RANGES.Y.min)}~${formatAngle(NORMAL_RANGES.Y.max)})`);
  } else if (angles.Y > NORMAL_RANGES.Y.max) {
    advice.push(`${NORMAL_RANGES.Y.name}: 오른쪽으로 너무 기울어져 있습니다. (현재: ${formatAngle(angles.Y)}, 정상: ${formatAngle(NORMAL_RANGES.Y.min)}~${formatAngle(NORMAL_RANGES.Y.max)})`);
  } else {
    advice.push(`${NORMAL_RANGES.Y.name}: 좋은 자세입니다. (현재: ${formatAngle(angles.Y)}, 정상: ${formatAngle(NORMAL_RANGES.Y.min)}~${formatAngle(NORMAL_RANGES.Y.max)})`);
  }
  
  // Z축 (몸통 회전) 피드백
  if (angles.Z < NORMAL_RANGES.Z.min) {
    advice.push(`${NORMAL_RANGES.Z.name}: 왼쪽으로 너무 회전되어 있습니다. (현재: ${formatAngle(angles.Z)}, 정상: ${formatAngle(NORMAL_RANGES.Z.min)}~${formatAngle(NORMAL_RANGES.Z.max)})`);
  } else if (angles.Z > NORMAL_RANGES.Z.max) {
    advice.push(`${NORMAL_RANGES.Z.name}: 오른쪽으로 너무 회전되어 있습니다. (현재: ${formatAngle(angles.Z)}, 정상: ${formatAngle(NORMAL_RANGES.Z.min)}~${formatAngle(NORMAL_RANGES.Z.max)})`);
  } else {
    advice.push(`${NORMAL_RANGES.Z.name}: 좋은 자세입니다. (현재: ${formatAngle(angles.Z)}, 정상: ${formatAngle(NORMAL_RANGES.Z.min)}~${formatAngle(NORMAL_RANGES.Z.max)})`);
  }

  if (overallScore >= 85) {
    riskLevel = 'safe';
    summaryMessage = '매우 좋은 자세입니다! 계속 유지해주세요.';
  } else if (overallScore >= 70) {
    riskLevel = 'safe';
    summaryMessage = '좋은 자세입니다. 약간의 개선으로 완벽해질 수 있어요.';
  } else if (overallScore >= 50) {
    riskLevel = 'warning';
    summaryMessage = '주의가 필요한 자세입니다. 피드백을 확인하고 자세를 교정해보세요.';
  } else {
    riskLevel = 'danger';
    summaryMessage = '나쁜 자세입니다. 즉시 자세를 바로잡고, 장시간 지속 시 전문가와 상담하세요.';
  }
  
  // 만약 모든 축이 정상 범위 내에 있다면 요약 메시지 덮어쓰기 (사용자 예시와 유사하게)
  if (isAngleWithinNormalRange(angles)) { // isAngleWithinNormalRange는 angleConverter.ts에 정의된 NORMAL_RANGES를 사용하므로, 여기서 정의한 NORMAL_RANGES와 범위가 다를 수 있음. 주의 필요.
                                        // angleConverter.ts의 NORMAL_RANGES가 더 관대할 수 있음.
                                        // 일관성을 위해 여기서 정의한 NORMAL_RANGES 기준으로 모든 축이 정상인지 다시 확인하거나, isAngleWithinNormalRange의 기준을 통일해야 함.
    const allGood = categoryScores.neck === 100 && categoryScores.back === 100 && categoryScores.rotation === 100;
    if(allGood && overallScore >=95) { // 모든 축이 100점이고 종합점수가 95점 이상이면 (가중치 때문에 100점이 아닐 수 있음)
        summaryMessage = '훌륭한 자세를 유지하고 있습니다. 계속 신경 써주세요!';
        riskLevel = 'safe';
    } else if (allGood && overallScore >= 85) {
        summaryMessage = '좋은 자세를 유지하고 있습니다. 계속 신경 써주세요!';
        riskLevel = 'safe';
    }
  }

  return {
    overallScore,
    riskLevel,
    summaryMessage,
    detailedAdvice: advice,
    categoryScores
  };
}

/**
 * AngleData와 RawSensorData의 number를 받아 PostureScore 객체를 생성합니다.
 * @param analysis PostureAnalysisResult 객체
 * @param rawDataNumber RawSensorData의 number (PostureScore의 number와 동일)
 * @param timestamp 기준 timestamp
 * @returns PostureScore 객체
 */
export function createPostureScoreFromAnalysis(
  analysis: PostureAnalysisResult,
  rawDataNumber: number,
  timestamp: Date
): PostureScore {
  return createPostureScore(
    rawDataNumber,
    analysis.overallScore,
    analysis.categoryScores.neck,
    analysis.categoryScores.back,
    analysis.categoryScores.rotation,
    analysis.summaryMessage, // feedback으로 summaryMessage 사용
    timestamp
  );
} 