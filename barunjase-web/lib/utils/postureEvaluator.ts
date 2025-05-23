import { parseJsonEnvVariable } from '@/lib/utils/envParser';

// Interface definitions
export interface AxisFeedback {
  angle: number;
  risk: 'safe' | 'warning' | 'danger' | 'unknown';
  deviation: number;
  normalRange: { min: number; max: number };
}

export interface CurrentPostureFeedback {
  timestamp: string;
  angles?: { x: number; y: number; z: number }; // 원본 각도 데이터 추가 (선택적)
  overallScore: number;
  feedbackPerAxis: {
    x: AxisFeedback;
    y: AxisFeedback;
    z: AxisFeedback;
  };
  summaryMessage: string;
  detailedAdvice: string[];
  riskLevel?: 'safe' | 'warning' | 'danger' | 'unknown'; // 종합 위험도
  cacheStatus?: 'hit' | 'miss';
}

// Type for normal ranges
export interface NormalRanges {
  X: { min: number; max: number };
  Y: { min: number; max: number };
  Z: { min: number; max: number };
}

// Type for risk thresholds
export interface RiskThresholds {
  warning: number; // Deviation for warning
  danger: number;  // Deviation for danger
}

// Type for score weights
export interface ScoreWeights {
  X: number;
  Y: number;
  Z: number;
}

// Default values
export const DEFAULT_NORMAL_RANGES: NormalRanges = {
  X: { min: -15, max: 15 }, // 목: 좌우 기울기 (좌 - / 우 +)
  Y: { min: -10, max: 10 }, // 허리: 좌우 기울기 (좌 - / 우 +)
  Z: { min: -10, max: 10 }, // 목: 앞뒤 기울기 (앞 + / 뒤 -)
};

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  warning: 5, // 5도 이상 벗어나면 '주의'
  danger: 15, // 15도 이상 벗어나면 '위험'
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  X: 0.4, // 목 좌우 중요도
  Y: 0.4, // 허리 좌우 중요도
  Z: 0.2, // 목 앞뒤 중요도
};

const DEFAULT_MAX_DEVIATION_FOR_SCORE = 30; // 점수 계산시 최대 이탈 각도 (이 값을 넘으면 0점 처리)

// Load from environment variables or use defaults
export const NORMAL_RANGES = parseJsonEnvVariable<NormalRanges>(
  process.env.FEEDBACK_NORMAL_RANGES,
  DEFAULT_NORMAL_RANGES
);

export const RISK_THRESHOLDS = parseJsonEnvVariable<RiskThresholds>(
  process.env.FEEDBACK_RISK_THRESHOLDS,
  DEFAULT_RISK_THRESHOLDS
);

export const SCORE_WEIGHTS = parseJsonEnvVariable<ScoreWeights>(
  process.env.FEEDBACK_SCORE_WEIGHTS,
  DEFAULT_SCORE_WEIGHTS
);

export const MAX_DEVIATION_FOR_SCORE = 
  typeof process.env.FEEDBACK_MAX_DEVIATION_FOR_SCORE === 'string' 
    ? parseInt(process.env.FEEDBACK_MAX_DEVIATION_FOR_SCORE, 10) 
    : DEFAULT_MAX_DEVIATION_FOR_SCORE;

// Advice generation
export const AXIS_FRIENDLY_NAMES = {
  X: '목(좌우 기울기)',
  Y: '허리(좌우 기울기)',
  Z: '목(앞뒤 숙임/젖힘)',
};

export const ADVICE_PRIORITY = ['danger', 'warning', 'safe', 'unknown'] as const;

export const ADVICE_TEMPLATES = {
  safe: (axisName: string, angle: number, range: {min: number, max: number}) => 
    `${axisName}: 좋은 자세를 유지하고 있습니다. (현재: ${angle.toFixed(1)}°, 정상: ${range.min}°~${range.max}°)`,
  warning: (axisName: string, angle: number, deviation: number, range: {min: number, max: number}) => {
    const direction = angle > range.max ? (axisName.includes("허리") ? "오른쪽(또는 왼쪽)" : (axisName.includes("숙임") ? "앞으로" : "오른쪽")) : (axisName.includes("허리") ? "왼쪽(또는 오른쪽)" : (axisName.includes("숙임") ? "뒤로" : "왼쪽"));
    return `${axisName}: ${Math.abs(deviation).toFixed(0)}° 벗어났습니다. ${direction}으로 약간 기울어진 것 같습니다. 가볍게 반대 방향으로 조정해보세요. (현재: ${angle.toFixed(1)}°, 정상: ${range.min}°~${range.max}°)`;
  },
  danger: (axisName: string, angle: number, deviation: number, range: {min: number, max: number}) => {
    const direction = angle > range.max ? (axisName.includes("허리") ? "오른쪽(또는 왼쪽)" : (axisName.includes("숙임") ? "앞으로" : "오른쪽")) : (axisName.includes("허리") ? "왼쪽(또는 오른쪽)" : (axisName.includes("숙임") ? "뒤로" : "왼쪽"));
    return `${axisName}: ${Math.abs(deviation).toFixed(0)}° 크게 벗어났습니다! ${direction}으로 많이 기울어져 있습니다. 즉시 자세를 바로잡아 주세요. (현재: ${angle.toFixed(1)}°, 정상: ${range.min}°~${range.max}°)`;
  },
  unknown: (axisName: string) => `${axisName}: 각도 정보를 확인할 수 없습니다.`
};

export function assessAxisRisk(
  angle: number | undefined | null,
  normalRange: { min: number; max: number },
  thresholds: RiskThresholds
): AxisFeedback {
  if (angle === undefined || angle === null || isNaN(angle)) {
    return { angle: NaN, risk: 'unknown', deviation: NaN, normalRange };
  }

  let deviation = 0;
  if (angle < normalRange.min) {
    deviation = angle - normalRange.min;
  } else if (angle > normalRange.max) {
    deviation = angle - normalRange.max;
  }

  const absDeviation = Math.abs(deviation);
  let risk: AxisFeedback['risk'] = 'safe';
  if (absDeviation >= thresholds.danger) {
    risk = 'danger';
  } else if (absDeviation >= thresholds.warning) {
    risk = 'warning';
  }

  return { angle, risk, deviation, normalRange };
}

export function calculateOverallScore(
  feedbackX: AxisFeedback,
  feedbackY: AxisFeedback,
  feedbackZ: AxisFeedback,
  weights: ScoreWeights,
  maxDeviationForScore: number
): number {
  if (feedbackX.risk === 'unknown' || feedbackY.risk === 'unknown' || feedbackZ.risk === 'unknown') {
    return 0; // 데이터 없음 시 0점
  }

  const scoreComponent = (feedback: AxisFeedback, weight: number) => {
    const normalizedDeviation = Math.min(Math.abs(feedback.deviation), maxDeviationForScore);
    // 편차가 0이면 1, 최대 편차이면 0
    const scoreFactor = 1 - (normalizedDeviation / maxDeviationForScore);
    return weight * scoreFactor * 100;
  };

  const score =
    scoreComponent(feedbackX, weights.X) +
    scoreComponent(feedbackY, weights.Y) +
    scoreComponent(feedbackZ, weights.Z);
  
  return Math.max(0, Math.min(Math.round(score), 100));
}

export function generateAdvice(
  feedbackX: AxisFeedback,
  feedbackY: AxisFeedback,
  feedbackZ: AxisFeedback
): { summaryMessage: string; detailedAdvice: string[]; overallRisk: typeof ADVICE_PRIORITY[number] } {
  const feedbacks = { X: feedbackX, Y: feedbackY, Z: feedbackZ };
  let detailedAdvice: string[] = [];
  let problemCount = 0;
  
  // 모든 피드백의 risk를 수집
  const risks = [feedbacks.X.risk, feedbacks.Y.risk, feedbacks.Z.risk];

  // 우선순위에 따라 가장 심각한 위험도 결정
  let mostSevereRisk: typeof ADVICE_PRIORITY[number] = 'unknown'; // 기본값 unknown
  for (const priority of ADVICE_PRIORITY) { // ADVICE_PRIORITY 배열: ['danger', 'warning', 'safe', 'unknown']
    if (risks.includes(priority)) {
      mostSevereRisk = priority; // 가장 먼저 발견되는 높은 우선순위의 risk
      break; 
    }
  }

  // 상세 조언 생성 로직: 위험도가 'safe' 또는 'unknown'이 아닌 경우에만 조언 추가
  (Object.keys(feedbacks) as Array<keyof typeof feedbacks>).forEach(axis => {
    const fb = feedbacks[axis];
    if (fb.risk !== 'safe' && fb.risk !== 'unknown') {
      problemCount++;
      // @ts-ignore ADVICE_TEMPLATES의 키가 fb.risk ('danger' | 'warning')와 일치해야 함.
      // ADVICE_TEMPLATES에 safe, unknown도 있지만 여기서는 사용 안함.
      if (fb.risk === 'danger' || fb.risk === 'warning') { // 타입 체커를 위한 명시적 확인
         detailedAdvice.push(ADVICE_TEMPLATES[fb.risk](AXIS_FRIENDLY_NAMES[axis], fb.angle, fb.deviation, fb.normalRange));
      }
    }
  });
  
  // 만약 mostSevereRisk가 'safe'이고 (즉, danger나 warning이 없었음), detailedAdvice가 비어있다면 safe 메시지 추가
  if (mostSevereRisk === 'safe' && problemCount === 0 && detailedAdvice.length === 0) {
     let largestDeviationAxis: keyof typeof feedbacks | null = null;
     let maxAbsDeviation = -1;

     (Object.keys(feedbacks) as Array<keyof typeof feedbacks>).forEach(axis => {
        const fb = feedbacks[axis];
        if (fb.risk === 'safe' && Math.abs(fb.deviation) > maxAbsDeviation) {
            maxAbsDeviation = Math.abs(fb.deviation);
            largestDeviationAxis = axis;
        }
     });
     
     if (largestDeviationAxis) {
         const fb = feedbacks[largestDeviationAxis];
         // @ts-ignore
         detailedAdvice.push(ADVICE_TEMPLATES.safe(AXIS_FRIENDLY_NAMES[largestDeviationAxis], fb.angle, fb.normalRange));
     } else if (feedbacks.X) { // fallback to X axis if all deviations are 0
        // @ts-ignore
        detailedAdvice.push(ADVICE_TEMPLATES.safe(AXIS_FRIENDLY_NAMES.X, feedbacks.X.angle, feedbacks.X.normalRange));
     }
  }

  let summaryMessage = '';
  if (mostSevereRisk === 'danger') {
    summaryMessage = '자세에 심각한 문제가 있습니다. 즉시 교정이 필요합니다.';
  } else if (mostSevereRisk === 'warning') {
    summaryMessage = '자세 개선이 필요합니다.';
    const warningAxes = (Object.keys(feedbacks) as Array<keyof typeof feedbacks>)
      .filter(axis => feedbacks[axis].risk === 'warning')
      .map(axis => AXIS_FRIENDLY_NAMES[axis]);
    if (warningAxes.length > 0) {
      summaryMessage += ` 특히 ${warningAxes.join(', ')} 부분의 교정이 중요합니다.`;
    }
  } else if (mostSevereRisk === 'safe') {
    summaryMessage = '좋은 자세를 유지하고 있습니다. 계속 신경 써주세요!';
  } else {
    summaryMessage = '자세 데이터를 분석 중입니다.';
  }
  
  if (detailedAdvice.length === 0 && mostSevereRisk === 'unknown') {
    summaryMessage = '최신 자세 데이터를 찾을 수 없거나, 데이터 형식이 올바르지 않아 분석할 수 없습니다.';
    detailedAdvice.push('센서 데이터가 정상적으로 수집되고 있는지 확인해주세요.');
  }

  return { summaryMessage, detailedAdvice, overallRisk: mostSevereRisk };
}

/**
 * Processes a single AngleData entry to generate posture feedback.
 * This is the core logic extracted from the API route.
 */
export function generatePostureFeedbackFromAngleData(
  latestAngleData: { angles?: { x: number; y: number; z: number }; timestamp: Date | string } | null
): CurrentPostureFeedback {
  if (!latestAngleData || !latestAngleData.angles) {
    const now = new Date();
    const { summaryMessage, detailedAdvice } = generateAdvice(
      assessAxisRisk(NaN, NORMAL_RANGES.X, RISK_THRESHOLDS),
      assessAxisRisk(NaN, NORMAL_RANGES.Y, RISK_THRESHOLDS),
      assessAxisRisk(NaN, NORMAL_RANGES.Z, RISK_THRESHOLDS)
    );
    return {
      timestamp: now.toISOString(),
      overallScore: 0,
      feedbackPerAxis: {
        x: assessAxisRisk(NaN, NORMAL_RANGES.X, RISK_THRESHOLDS),
        y: assessAxisRisk(NaN, NORMAL_RANGES.Y, RISK_THRESHOLDS),
        z: assessAxisRisk(NaN, NORMAL_RANGES.Z, RISK_THRESHOLDS),
      },
      summaryMessage,
      detailedAdvice,
      riskLevel: 'unknown',
    };
  }

  const angles = latestAngleData.angles;
  const feedbackX = assessAxisRisk(angles.x, NORMAL_RANGES.X, RISK_THRESHOLDS);
  const feedbackY = assessAxisRisk(angles.y, NORMAL_RANGES.Y, RISK_THRESHOLDS);
  const feedbackZ = assessAxisRisk(angles.z, NORMAL_RANGES.Z, RISK_THRESHOLDS);

  const overallScore = calculateOverallScore(feedbackX, feedbackY, feedbackZ, SCORE_WEIGHTS, MAX_DEVIATION_FOR_SCORE);
  const { summaryMessage, detailedAdvice, overallRisk } = generateAdvice(feedbackX, feedbackY, feedbackZ);

  return {
    timestamp: new Date(latestAngleData.timestamp).toISOString(),
    angles: latestAngleData.angles, // 원본 각도 데이터 포함
    overallScore,
    feedbackPerAxis: { x: feedbackX, y: feedbackY, z: feedbackZ },
    summaryMessage,
    detailedAdvice,
    riskLevel: overallRisk,
  };
} 