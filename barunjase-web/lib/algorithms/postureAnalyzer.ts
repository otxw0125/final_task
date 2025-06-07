import { AngleResult, isAngleWithinNormalRange, formatAngle } from './angleConverter';
import { PostureScore, createPostureScore } from '../models/PostureScore';

/**
 * AngleResult를 기반으로 PostureScore 객체 생성을 위한 상세 정보를 생성합니다.
 * (앉은 자세 전용)
 */
export interface PostureAnalysisResult {
  overallScore: number;
  riskLevel: 'safe' | 'warning' | 'danger';
  summaryMessage: string;
  detailedAdvice: string[];
  categoryScores: {
    leftRight: number; // X축 (좌우 기울기)
    frontBack: number; // Y축 (앞뒤 기울기)
  };
}

const NORMAL_RANGES = {
  X: { min: -15, max: 15, name: '좌우 기울기(허리)', goodScore: 50 }, // 좌우 기울기
  Y: { min: -20, max: 20, name: '앞뒤 기울기(등)', goodScore: 50 }, // 앞뒤 기울기
};

const SCORE_WEIGHTS = {
    X: 0.5, // 좌우 기울기
    Y: 0.5  // 앞뒤 기울기
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
  // 범위를 벗어날수록 점수 급격히 감소
  const deviation = Math.min(Math.abs(angle - min), Math.abs(angle - max));
  let score = 100 - deviation * 3; // 1도 벗어날 때마다 3점 감점 (더 엄격하게)
  return Math.max(0, Math.min(100, score)); // 0점 미만, 100점 초과 방지
}

/**
 * AngleResult를 분석하여 자세 점수 및 피드백을 생성합니다. (앉은 자세용)
 * @param angles AngleResult 객체
 * @returns PostureAnalysisResult
 */
export function analyzePostureFromAngles(angles: AngleResult): PostureAnalysisResult {
  const advice: string[] = [];
  let totalWeightedScore = 0;

  const categoryScores = {
    leftRight: calculateAxisScore(angles.X, NORMAL_RANGES.X),
    frontBack: calculateAxisScore(angles.Y, NORMAL_RANGES.Y),
  };

  totalWeightedScore = 
      categoryScores.leftRight * SCORE_WEIGHTS.X +
      categoryScores.frontBack * SCORE_WEIGHTS.Y;

  const overallScore = Math.round(totalWeightedScore);

  let riskLevel: 'safe' | 'warning' | 'danger';
  let summaryMessage: string;

  // X축 (좌우 기울기) 피드백
  if (angles.X < NORMAL_RANGES.X.min) {
    advice.push(`${NORMAL_RANGES.X.name}: 왼쪽으로 너무 기울어져 있습니다. (현재: ${formatAngle(angles.X)}, 정상: ${formatAngle(NORMAL_RANGES.X.min)}~${formatAngle(NORMAL_RANGES.X.max)})`);
  } else if (angles.X > NORMAL_RANGES.X.max) {
    advice.push(`${NORMAL_RANGES.X.name}: 오른쪽으로 너무 기울어져 있습니다. (현재: ${formatAngle(angles.X)}, 정상: ${formatAngle(NORMAL_RANGES.X.min)}~${formatAngle(NORMAL_RANGES.X.max)})`);
  } else {
    advice.push(`${NORMAL_RANGES.X.name}: 좋은 자세입니다. (현재: ${formatAngle(angles.X)}, 정상: ${formatAngle(NORMAL_RANGES.X.min)}~${formatAngle(NORMAL_RANGES.X.max)})`);
  }

  // Y축 (앞뒤 기울기) 피드백
  if (angles.Y < NORMAL_RANGES.Y.min) {
    advice.push(`${NORMAL_RANGES.Y.name}: 뒤로 너무 기울어져 있습니다. (현재: ${formatAngle(angles.Y)}, 정상: ${formatAngle(NORMAL_RANGES.Y.min)}~${formatAngle(NORMAL_RANGES.Y.max)})`);
  } else if (angles.Y > NORMAL_RANGES.Y.max) {
    advice.push(`${NORMAL_RANGES.Y.name}: 앞으로 너무 기울어져 있습니다. (현재: ${formatAngle(angles.Y)}, 정상: ${formatAngle(NORMAL_RANGES.Y.min)}~${formatAngle(NORMAL_RANGES.Y.max)})`);
  } else {
    advice.push(`${NORMAL_RANGES.Y.name}: 좋은 자세입니다. (현재: ${formatAngle(angles.Y)}, 정상: ${formatAngle(NORMAL_RANGES.Y.min)}~${formatAngle(NORMAL_RANGES.Y.max)})`);
  }

  if (overallScore >= 85) {
    riskLevel = 'safe';
    summaryMessage = '매우 좋은 앉은 자세입니다! 계속 유지해주세요.';
  } else if (overallScore >= 70) {
    riskLevel = 'safe';
    summaryMessage = '좋은 앉은 자세입니다. 약간의 개선으로 완벽해질 수 있어요.';
  } else if (overallScore >= 50) {
    riskLevel = 'warning';
    summaryMessage = '주의가 필요한 앉은 자세입니다. 피드백을 확인하고 자세를 교정해보세요.';
  } else {
    riskLevel = 'danger';
    summaryMessage = '나쁜 앉은 자세입니다. 즉시 자세를 바로잡고, 장시간 지속 시 전문가와 상담하세요.';
  }
  
  // 만약 모든 축이 정상 범위 내에 있다면 요약 메시지 덮어쓰기
  if (isAngleWithinNormalRange(angles)) {
    const allGood = categoryScores.leftRight === 100 && categoryScores.frontBack === 100;
    if(allGood && overallScore >=95) {
        summaryMessage = '훌륭한 앉은 자세를 유지하고 있습니다. 계속 신경 써주세요!';
        riskLevel = 'safe';
    } else if (allGood && overallScore >= 85) {
        summaryMessage = '좋은 앉은 자세를 유지하고 있습니다. 계속 신경 써주세요!';
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
    analysis.categoryScores.leftRight,
    analysis.categoryScores.frontBack,
    0, // Z축 점수는 0으로 설정 (사용하지 않음)
    analysis.summaryMessage, // feedback으로 summaryMessage 사용
    timestamp
  );
} 