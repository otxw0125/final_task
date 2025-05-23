import { NextRequest, NextResponse } from 'next/server';
import { getAngleDataCollection } from '../../../../lib/db/collections';
import { AngleData } from '../../../../lib/models/AngleData';
import { memoryCache } from '../../../../lib/cache/memoryCache';

console.log('[API /api/feedback/current] Loading module...'); // 모듈 로딩 확인

// --- Helper function to parse JSON environment variables ---
function parseJsonEnvVariable<T>(envVar: string | undefined, defaultValue: T): T {
  // console.log(`[parseJsonEnvVariable] Parsing env var: ${envVar}`); // 로그 간소화
  if (envVar) {
    try {
      return JSON.parse(envVar) as T;
    } catch (error) {
      console.warn(`[parseJsonEnvVariable] Failed to parse JSON. Using default. Error: ${error}`);
      return defaultValue;
    }
  }
  return defaultValue;
}

// --- 타입 정의 ---

/**
 * 각 축의 각도 및 위험도
 */
interface AxisFeedback {
  angle: number;
  risk: 'safe' | 'warning' | 'danger' | 'unknown'; // 위험도 등급
  normalRange: { min: number; max: number };
  deviation?: number; // 정상 범위에서 벗어난 정도
}

/**
 * 자세 평가 결과 인터페이스
 */
export interface CurrentPostureFeedback {
  timestamp: string; // 데이터 측정 시간
  overallScore: number; // 전체 자세 점수 (0-100)
  feedbackPerAxis: {
    x: AxisFeedback; // 목 기울기 (Pitch)
    y: AxisFeedback; // 허리 기울기 (Roll)
    z: AxisFeedback; // 몸통 회전 (Yaw)
  };
  summaryMessage: string; // 자세에 대한 간략한 요약 메시지
  detailedAdvice: string[]; // 구체적인 개선 조언 목록
  riskLevel?: 'safe' | 'warning' | 'danger' | 'unknown'; // 전체적인 위험도 수준 추가
  cacheStatus?: 'hit' | 'miss'; // (디버깅용) 캐시 상태 표시
}

// --- 상수 정의 ---

// 각 축별 정상 각도 범위 (도 단위) - 환경 변수에서 로드
const DEFAULT_NORMAL_RANGES = {
  X: { min: -15, max: 15 }, // 상체 앞뒤 기울기 (0도: 등받이에 기댐, 양수: 앞으로 숙임)
  Y: { min: -10, max: 10 }, // 상체 좌우 기울기 (0도: 좌우 균형, 양수: 오른쪽으로 기울임)
  Z: { min: -10, max: 10 }, // 몸통 비틀림 (0도: 정면, 양수: 오른쪽 비틀림 가정)
};
const NORMAL_RANGES = parseJsonEnvVariable(process.env.FEEDBACK_NORMAL_RANGES, DEFAULT_NORMAL_RANGES);
console.log('[API /api/feedback/current] NORMAL_RANGES:', NORMAL_RANGES);

// 각 축별 위험도 판단을 위한 경계값 (정상 범위를 기준으로 한 절대 편차값) - 환경 변수에서 로드
const DEFAULT_RISK_THRESHOLDS = {
  warning: 5,  // 예: 정상범위 +-5도 초과 시 '주의'
  danger: 15,  // 예: 정상범위 +-15도 초과 시 '위험'
};
const RISK_THRESHOLDS = parseJsonEnvVariable(process.env.FEEDBACK_RISK_THRESHOLDS, DEFAULT_RISK_THRESHOLDS);
console.log('[API /api/feedback/current] RISK_THRESHOLDS:', RISK_THRESHOLDS);

// 자세 점수 계산 시 각 축별 가중치 - 환경 변수에서 로드
const DEFAULT_SCORE_WEIGHTS = {
  X: 0.4, // 목
  Y: 0.4, // 허리
  Z: 0.2, // 회전
};
const SCORE_WEIGHTS = parseJsonEnvVariable(process.env.FEEDBACK_SCORE_WEIGHTS, DEFAULT_SCORE_WEIGHTS);
console.log('[API /api/feedback/current] SCORE_WEIGHTS:', SCORE_WEIGHTS);

// 최대 편차 (점수 계산 시 사용, 이 값을 넘어서는 편차는 최대 페널티로 간주) - 환경 변수에서 로드
const MAX_DEVIATION_FOR_SCORE_ENV = process.env.FEEDBACK_MAX_DEVIATION_FOR_SCORE;
console.log('[API /api/feedback/current] MAX_DEVIATION_FOR_SCORE_ENV:', MAX_DEVIATION_FOR_SCORE_ENV);
const MAX_DEVIATION_FOR_SCORE = parseInt(MAX_DEVIATION_FOR_SCORE_ENV || '30', 10);
console.log('[API /api/feedback/current] MAX_DEVIATION_FOR_SCORE:', MAX_DEVIATION_FOR_SCORE);

// 자세 개선 조언 메시지 템플릿
const ADVICE_TEMPLATES: Record<string, any> = {
  X: { // 상체 앞뒤 기울기
    danger: {
      positiveDeviation: "상체가 앞으로 너무 많이 숙여졌습니다. 약 {deviation}° 뒤로 기대어 등받이에 편안히 앉으세요.",
      negativeDeviation: "상체가 뒤로 너무 많이 젖혀졌습니다. 약 {deviation}° 앞으로 자세를 바로 하세요. (센서 부착 상태 확인 필요)",
    },
    warning: {
      positiveDeviation: "상체가 약간 앞으로 숙여진 경향이 있습니다. {deviation}° 정도 가볍게 뒤로 기대보세요.",
      negativeDeviation: "상체가 약간 뒤로 젖혀진 경향이 있습니다. {deviation}° 정도 가볍게 자세를 바로 해보세요.",
    },
    safe: "상체의 앞뒤 기울기가 좋습니다.",
  },
  Y: { // 상체 좌우 기울기
    danger: {
      positiveDeviation: "상체가 오른쪽으로 너무 많이 기울었습니다. 약 {deviation}° 왼쪽으로 교정하여 몸의 중심을 잡으세요.",
      negativeDeviation: "상체가 왼쪽으로 너무 많이 기울었습니다. 약 {deviation}° 오른쪽으로 교정하여 몸의 중심을 잡으세요.",
    },
    warning: {
      positiveDeviation: "상체가 약간 오른쪽으로 기울어진 것 같습니다. {deviation}° 정도 가볍게 왼쪽으로 조정해보세요.",
      negativeDeviation: "상체가 약간 왼쪽으로 기울어진 것 같습니다. {deviation}° 정도 가볍게 오른쪽으로 조정해보세요.",
    },
    safe: "상체의 좌우 균형이 좋습니다.",
  },
  Z: { // 몸통 비틀림
    danger: {
      positiveDeviation: "몸통이 오른쪽으로 너무 많이 비틀렸습니다. 약 {deviation}° 왼쪽으로 돌려 정면을 향하도록 하세요.",
      negativeDeviation: "몸통이 왼쪽으로 너무 많이 비틀렸습니다. 약 {deviation}° 오른쪽으로 돌려 정면을 향하도록 하세요.",
    },
    warning: {
      positiveDeviation: "몸통이 약간 오른쪽으로 비틀린 것 같습니다. {deviation}° 정도 가볍게 정면으로 돌려주세요.",
      negativeDeviation: "몸통이 약간 왼쪽으로 비틀린 것 같습니다. {deviation}° 정도 가볍게 정면으로 돌려주세요.",
    },
    safe: "몸통의 비틀림이 적절합니다.",
  },
  unknown: "자세 데이터를 분석할 수 없습니다."
};

// 각 축의 이름 (조언 메시지용)
const AXIS_FRIENDLY_NAMES: Record<string, string> = {
  X: "상체 앞뒤 기울기",
  Y: "상체 좌우 기울기",
  Z: "몸통 비틀림",
};

// --- 헬퍼 함수 ---

/**
 * 각 축의 위험도 평가
 */
function assessAxisRisk(angle: number, normalRange: { min: number; max: number }): { risk: AxisFeedback['risk'], deviation: number } {
  let deviation = 0;
  if (angle < normalRange.min) {
    deviation = normalRange.min - angle;
  } else if (angle > normalRange.max) {
    deviation = angle - normalRange.max;
  }

  if (deviation === 0) {
    return { risk: 'safe', deviation };
  } else if (deviation <= RISK_THRESHOLDS.warning) {
    return { risk: 'warning', deviation };
  } else {
    return { risk: 'danger', deviation };
  }
}

/**
 * 전체 자세 점수 계산
 */
function calculateOverallScore(feedback: CurrentPostureFeedback['feedbackPerAxis']): number {
  let weightedScoreSum = 0;

  const calculateAxisContribution = (axisFeedback: AxisFeedback, weightKey: 'X' | 'Y' | 'Z'): number => {
    // 편차를 기반으로 0~1 사이의 페널티 비율 계산 (0: 페널티 없음, 1: 최대 페널티)
    // deviation이 0이면 penaltyRatio는 0. MAX_DEVIATION_FOR_SCORE에 도달하면 1.
    const penaltyRatio = Math.min(1, (axisFeedback.deviation || 0) / MAX_DEVIATION_FOR_SCORE);
    // 해당 축의 점수 (100점 만점) = (1 - 페널티 비율) * 100
    const axisScore = (1 - penaltyRatio) * 100;
    return axisScore * SCORE_WEIGHTS[weightKey];
  };

  weightedScoreSum += calculateAxisContribution(feedback.x, 'X');
  weightedScoreSum += calculateAxisContribution(feedback.y, 'Y');
  weightedScoreSum += calculateAxisContribution(feedback.z, 'Z');
  
  return Math.max(0, Math.min(100, Math.round(weightedScoreSum))); // 0-100 사이로 점수 보정
}

/**
 * 자세 개선 조언 생성 (고도화)
 */
function generateAdvice(feedback: CurrentPostureFeedback['feedbackPerAxis']): { summary: string, details: string[] } {
  if (feedback.x.risk === 'unknown' || feedback.y.risk === 'unknown' || feedback.z.risk === 'unknown') {
    return { summary: ADVICE_TEMPLATES.unknown, details: ["센서 데이터를 확인해주세요."] };
  }

  const problems: Array<{ axisKey: 'X' | 'Y' | 'Z'; risk: 'danger' | 'warning'; deviation: number; angle: number; normalRange: {min: number; max: number}; message: string }> = [];

  (['x', 'y', 'z'] as const).forEach(axisLowerCaseKey => {
    const axisFeedback = feedback[axisLowerCaseKey];
    const axisUpperCaseKey = axisLowerCaseKey.toUpperCase() as 'X' | 'Y' | 'Z'; // 대문자 키로 변환

    if (axisFeedback.risk === 'danger' || axisFeedback.risk === 'warning') {
      const deviation = axisFeedback.deviation || 0;
      const angle = axisFeedback.angle;
      let templateKey: 'positiveDeviation' | 'negativeDeviation';
      
      if (angle > axisFeedback.normalRange.max) {
        templateKey = 'positiveDeviation'; // 정상 범위보다 각도가 큼 (예: 목이 앞으로 많이 숙여짐)
      } else if (angle < axisFeedback.normalRange.min) {
        templateKey = 'negativeDeviation'; // 정상 범위보다 각도가 작음 (예: 목이 뒤로 많이 젖혀짐)
      } else {
        // 이 경우는 risk가 safe여야 하므로, 여기까지 오면 로직 오류 또는 데이터 이상
        console.warn(`Unexpected case in generateAdvice for axis ${axisUpperCaseKey}: risk is ${axisFeedback.risk} but angle ${angle} is within normal range ${axisFeedback.normalRange.min}-${axisFeedback.normalRange.max}`);
        return; // 이 축에 대한 조언은 건너뜀
      }

      let message = ADVICE_TEMPLATES[axisUpperCaseKey][axisFeedback.risk][templateKey]
        .replace('{deviation}', String(Math.round(deviation)));
      // Y, Z축의 경우 좌우 구분이 어려우므로, 현재 각도와 정상 범위를 추가 정보로 제공
      message += ` (현재: ${angle.toFixed(1)}°, 정상: ${axisFeedback.normalRange.min}°~${axisFeedback.normalRange.max}°)`;
        
      problems.push({
        axisKey: axisUpperCaseKey,
        risk: axisFeedback.risk,
        deviation,
        angle,
        normalRange: axisFeedback.normalRange,
        message
      });
    }
  });

  if (problems.length === 0) {
    return { summary: "훌륭합니다! 현재 자세가 매우 좋습니다.", details: ["계속해서 좋은 자세를 유지해주세요."] };
  }

  // 우선순위 정렬: 1. risk (danger > warning), 2. deviation (큰 값 우선), 3. SCORE_WEIGHTS (큰 값 우선)
  problems.sort((a, b) => {
    if (a.risk === 'danger' && b.risk === 'warning') return -1;
    if (a.risk === 'warning' && b.risk === 'danger') return 1;
    if (a.deviation !== b.deviation) return b.deviation - a.deviation;
    return (SCORE_WEIGHTS[b.axisKey] || 0) - (SCORE_WEIGHTS[a.axisKey] || 0);
  });

  const detailedAdvice: string[] = problems.map(p => `${AXIS_FRIENDLY_NAMES[p.axisKey]}: ${p.message}`);
  
  // 요약 메시지: 가장 중요한 문제 1~2개 언급 또는 전체적인 상태 요약
  let summaryMessage = "자세 개선이 필요합니다. ";
  if (problems.length > 0) {
    summaryMessage += `특히 ${AXIS_FRIENDLY_NAMES[problems[0].axisKey]} 부분의 교정이 중요합니다.`;
    if (problems.length > 1) {
      summaryMessage += ` 그 다음으로 ${AXIS_FRIENDLY_NAMES[problems[1].axisKey]}도 신경 써주세요.`;
    }
  } else {
    // 이 경우는 위에서 처리되었어야 하지만, 방어적으로 추가
    summaryMessage = "자세 정보를 분석 중입니다.";
  }
  
  // 너무 많은 조언보다는 우선순위 높은 것 위주로 제공 (예: 최대 2개)
  const prioritizedDetails = detailedAdvice.slice(0, 2);

  return { summary: summaryMessage, details: prioritizedDetails };
}


// --- API 핸들러 ---

const CURRENT_FEEDBACK_CACHE_KEY = 'current_posture_feedback';
// 현재 자세 피드백 캐시 TTL (초 단위) - 환경 변수에서 로드
const CURRENT_FEEDBACK_TTL_SECONDS = parseInt(process.env.FEEDBACK_CURRENT_TTL_SECONDS || '5', 10);

export async function GET(request: NextRequest) {
  console.log(`[API /api/feedback/current] GET handler called. URL: ${request.url}`);
  try {
    // 1. 캐시에서 데이터 조회
    const cachedFeedback = memoryCache.get<CurrentPostureFeedback>(CURRENT_FEEDBACK_CACHE_KEY);
    if (cachedFeedback) {
      console.log('[API /api/feedback/current] Cache hit');
      return NextResponse.json({ ...cachedFeedback, cacheStatus: 'hit' } as CurrentPostureFeedback);
    }
    console.log('[API /api/feedback/current] Cache miss');

    // 2. 최신 데이터 조회
    console.log('[API /api/feedback/current] Fetching latest angle data from DB...');
    const collection = await getAngleDataCollection();
    const latestDataArray = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    console.log(`[API /api/feedback/current] Fetched ${latestDataArray.length} record(s) from DB.`);

    if (!latestDataArray || latestDataArray.length === 0 || !latestDataArray[0].angles) {
      console.warn('[API /api/feedback/current] No angle data found or data format incorrect. Expected "angles" field.');
      if(latestDataArray && latestDataArray.length > 0) {
        console.log('[API /api/feedback/current] Fetched record missing "angles" field:', latestDataArray[0]);
      } else {
        console.log('[API /api/feedback/current] No records fetched from DB.');
      }
      const noDataResponse: CurrentPostureFeedback = {
        timestamp: new Date().toISOString(),
        overallScore: 0,
        feedbackPerAxis: {
          x: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.X, deviation: 0 },
          y: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.Y, deviation: 0 },
          z: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.Z, deviation: 0 },
        },
        summaryMessage: "최신 자세 데이터를 찾을 수 없습니다. 센서가 연결되어 데이터를 전송하는지 확인해주세요.",
        detailedAdvice: ["데이터가 없어 자세를 평가할 수 없습니다."],
        cacheStatus: 'miss',
      };
      // 데이터 없음 응답도 캐시할 수 있지만, 여기서는 그냥 반환 (필요에 따라 캐시 저장)
      memoryCache.set(CURRENT_FEEDBACK_CACHE_KEY, noDataResponse, CURRENT_FEEDBACK_TTL_SECONDS);
      return NextResponse.json(noDataResponse);
    }

    const latestAngleData = latestDataArray[0] as AngleData;
    const dbAngles = latestAngleData.angles;
    console.log('[API /api/feedback/current] Latest angles from DB (using angles field):', dbAngles);

    if (typeof dbAngles?.x !== 'number' || typeof dbAngles?.y !== 'number' || typeof dbAngles?.z !== 'number') {
      console.error('[API /api/feedback/current] Invalid angle data format in DB (expected angles.x/y/z to be numbers):', dbAngles);
      // 이 경우에도 noDataResponse와 유사한 응답 반환
      const invalidDataResponse: CurrentPostureFeedback = {
        timestamp: latestAngleData.timestamp ? new Date(latestAngleData.timestamp).toISOString() : new Date().toISOString(),
        overallScore: 0,
        feedbackPerAxis: {
          x: { angle: dbAngles?.x ?? 0, risk: 'unknown', normalRange: NORMAL_RANGES.X, deviation: 0 },
          y: { angle: dbAngles?.y ?? 0, risk: 'unknown', normalRange: NORMAL_RANGES.Y, deviation: 0 },
          z: { angle: dbAngles?.z ?? 0, risk: 'unknown', normalRange: NORMAL_RANGES.Z, deviation: 0 },
        },
        summaryMessage: "수신된 자세 데이터의 형식이 올바르지 않습니다.",
        detailedAdvice: ["센서 데이터 형식을 확인해주세요."],
        cacheStatus: 'miss',
      };
      memoryCache.set(CURRENT_FEEDBACK_CACHE_KEY, invalidDataResponse, CURRENT_FEEDBACK_TTL_SECONDS);
      return NextResponse.json(invalidDataResponse);
    }

    // 3. 자세 평가
    const feedbackPerAxis = {
      x: { angle: dbAngles.x, ...assessAxisRisk(dbAngles.x, NORMAL_RANGES.X), normalRange: NORMAL_RANGES.X },
      y: { angle: dbAngles.y, ...assessAxisRisk(dbAngles.y, NORMAL_RANGES.Y), normalRange: NORMAL_RANGES.Y },
      z: { angle: dbAngles.z, ...assessAxisRisk(dbAngles.z, NORMAL_RANGES.Z), normalRange: NORMAL_RANGES.Z },
    };
    
    const overallScore = calculateOverallScore(feedbackPerAxis as CurrentPostureFeedback['feedbackPerAxis']); // 타입 단언
    const advice = generateAdvice(feedbackPerAxis as CurrentPostureFeedback['feedbackPerAxis']); // 타입 단언

    // 전체적인 riskLevel 결정 로직 추가
    let overallRiskLevel: CurrentPostureFeedback['riskLevel'] = 'safe';
    if (feedbackPerAxis.x.risk === 'danger' || feedbackPerAxis.y.risk === 'danger' || feedbackPerAxis.z.risk === 'danger') {
      overallRiskLevel = 'danger';
    } else if (feedbackPerAxis.x.risk === 'warning' || feedbackPerAxis.y.risk === 'warning' || feedbackPerAxis.z.risk === 'warning') {
      overallRiskLevel = 'warning';
    } else if (feedbackPerAxis.x.risk === 'unknown' || feedbackPerAxis.y.risk === 'unknown' || feedbackPerAxis.z.risk === 'unknown') {
      overallRiskLevel = 'unknown';
    }

    const responseData: CurrentPostureFeedback = {
      timestamp: latestAngleData.timestamp ? new Date(latestAngleData.timestamp).toISOString() : new Date().toISOString(),
      overallScore,
      feedbackPerAxis: feedbackPerAxis as CurrentPostureFeedback['feedbackPerAxis'], // 최종 타입 단언
      summaryMessage: advice.summary,
      detailedAdvice: advice.details,
      riskLevel: overallRiskLevel, // 계산된 overallRiskLevel 사용
      cacheStatus: 'miss',
    };
    console.log('[API /api/feedback/current] Generated feedback data:', responseData);

    // 4. 캐시에 저장 및 응답 반환
    memoryCache.set(CURRENT_FEEDBACK_CACHE_KEY, responseData, CURRENT_FEEDBACK_TTL_SECONDS);
    console.log('[API /api/feedback/current] Data cached and returning response.');
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[API /api/feedback/current] Critical error in GET handler:', error);
    // 실제 에러 객체나 스택 트레이스를 로깅하는 것이 중요
    // 에러 타입에 따라 다른 상태 코드를 반환할 수 있음
    return NextResponse.json(
      { error: 'Failed to get current posture feedback.', details: (error as Error).message },
      { status: 500 }
    );
  }
} 