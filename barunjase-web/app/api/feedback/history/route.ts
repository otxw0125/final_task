import { NextRequest, NextResponse } from 'next/server';
import { getAngleDataCollection } from '../../../../lib/db/collections';
import { AngleData } from '../../../../lib/models/AngleData';
import { Collection, Document, Filter, Sort } from 'mongodb';

// --- 현재 피드백 API의 일부 로직 재사용 또는 유사 구현 ---
// (상수 및 헬퍼 함수들은 별도의 유틸리티 파일로 분리하는 것을 고려할 수 있습니다)

const NORMAL_RANGES = {
  X: { min: -15, max: 15 },
  Y: { min: -10, max: 10 },
  Z: { min: -10, max: 10 },
};

const RISK_THRESHOLDS = {
  warning: 5,
  danger: 15,
};

const SCORE_WEIGHTS = {
  X: 0.4,
  Y: 0.4,
  Z: 0.2,
};

const MAX_DEVIATION_FOR_SCORE = 30;

interface AxisFeedbackInput {
  angle: number;
  normalRange: { min: number; max: number };
}

interface AssessedAxisFeedback {
  angle: number;
  risk: 'safe' | 'warning' | 'danger' | 'unknown';
  normalRange: { min: number; max: number };
  deviation: number;
}

function assessAxisRiskInternal(angle: number, normalRange: { min: number; max: number }): { risk: AssessedAxisFeedback['risk'], deviation: number } {
  let deviation = 0;
  if (angle < normalRange.min) {
    deviation = normalRange.min - angle;
  } else if (angle > normalRange.max) {
    deviation = angle - normalRange.max;
  }
  if (deviation === 0) return { risk: 'safe', deviation };
  if (deviation <= RISK_THRESHOLDS.warning) return { risk: 'warning', deviation };
  return { risk: 'danger', deviation };
}

function calculateOverallScoreInternal(feedbackPerAxis: { x: AssessedAxisFeedback, y: AssessedAxisFeedback, z: AssessedAxisFeedback }): number {
  let weightedScoreSum = 0;
  const calculateAxisContribution = (axisFeedback: AssessedAxisFeedback, weight: number): number => {
    const penaltyRatio = Math.min(1, axisFeedback.deviation / MAX_DEVIATION_FOR_SCORE);
    const axisScore = (1 - penaltyRatio) * 100;
    return axisScore * weight;
  };
  weightedScoreSum += calculateAxisContribution(feedbackPerAxis.x, SCORE_WEIGHTS.X);
  weightedScoreSum += calculateAxisContribution(feedbackPerAxis.y, SCORE_WEIGHTS.Y);
  weightedScoreSum += calculateAxisContribution(feedbackPerAxis.z, SCORE_WEIGHTS.Z);
  return Math.max(0, Math.min(100, Math.round(weightedScoreSum)));
}

// --- 히스토리 API 타입 정의 ---

export interface PostureHistoryRequestParams {
  startDate: string; // ISO Date string
  endDate: string;   // ISO Date string
  timeUnit?: 'hour' | 'day'; // 시간별 또는 일별 집계 (기본값: day)
}

export interface TimeSegmentSummary {
  period: string; // 예: "2023-10-20T10:00:00.000Z" (시간별) 또는 "2023-10-20" (일별)
  avgScore: number | null;
  totalSamples: number;
  problemCounts: {
    x: { warning: number, danger: number };
    y: { warning: number, danger: number };
    z: { warning: number, danger: number };
  };
}

export interface PostureHistoryResponse {
  requestedPeriod: {
    startDate: string;
    endDate: string;
    timeUnit: 'hour' | 'day';
  };
  overallAverageScore: number | null;
  scoreTrend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
  timeSeriesSummary: TimeSegmentSummary[];
  mostFrequentProblems: Array<{ 
    axis: 'X' | 'Y' | 'Z'; 
    problemType: 'warning' | 'danger'; 
    description: string; 
    count: number 
  }>;
  // 추가 분석 데이터 (예: 자세가 나빠지는 시간대 패턴 등)는 추후 확장
}

const DEFAULT_TIME_UNIT = 'day';

// --- API 핸들러 ---

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const timeUnit = (searchParams.get('timeUnit') as PostureHistoryRequestParams['timeUnit']) || DEFAULT_TIME_UNIT;

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ success: false, error: 'startDate and endDate query parameters are required.' }, { status: 400 });
    }

    let startDate: Date, endDate: Date;
    try {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error('Invalid date format');
      if (startDate > endDate) throw new Error('startDate cannot be after endDate');
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `Invalid date format or range: ${e.message || 'Unknown error'}` }, { status: 400 });
    }
    
    // endDate를 해당 날짜의 끝으로 설정 (예: 2023-10-20 -> 2023-10-20T23:59:59.999Z)
    endDate.setHours(23, 59, 59, 999);

    const collection = await getAngleDataCollection();
    const query: Filter<AngleData> = {
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
      // 유효한 angles 데이터만 필터링 (x,y,z 모두 숫자여야 함)
      'angles.x': { $type: "number" },
      'angles.y': { $type: "number" },
      'angles.z': { $type: "number" },
    };

    const sort: Sort = { timestamp: 1 }; // 시간 순으로 정렬
    const historicalData = await collection.find(query).sort(sort).toArray();

    if (historicalData.length === 0) {
      return NextResponse.json({
        requestedPeriod: { startDate: startDateStr, endDate: endDateStr, timeUnit },
        overallAverageScore: null,
        scoreTrend: 'insufficient_data',
        timeSeriesSummary: [],
        mostFrequentProblems: [],
        message: "No data found for the specified period."
      }, { status: 200 }); // 데이터가 없는 것도 정상 응답일 수 있음
    }

    // 데이터 분석 및 집계
    const timeSeriesSummary: TimeSegmentSummary[] = [];
    const allScores: number[] = [];
    const problemCounter: Record<string, { axis: 'X' | 'Y' | 'Z'; problemType: 'warning' | 'danger'; description: string; count: number }> = {};

    // 시간 단위별 데이터 그룹화
    const groupedData: Record<string, AngleData[]> = {};
    historicalData.forEach(record => {
      if (!record.timestamp || !record.angles) return; // 필수 데이터 없으면 스킵
      const recordDate = new Date(record.timestamp);
      let groupKey = '';
      if (timeUnit === 'hour') {
        groupKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}T${String(recordDate.getHours()).padStart(2, '0')}:00:00.000Z`;
      } else { // day (default)
        groupKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
      }
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = [];
      }
      groupedData[groupKey].push(record);
    });

    for (const periodKey in groupedData) {
      const group = groupedData[periodKey];
      let periodTotalScore = 0;
      let validSamplesInPeriod = 0;
      const periodProblemCounts = {
        x: { warning: 0, danger: 0 },
        y: { warning: 0, danger: 0 },
        z: { warning: 0, danger: 0 },
      };

      group.forEach(item => {
        const angles = item.angles;
        if (typeof angles?.x !== 'number' || typeof angles?.y !== 'number' || typeof angles?.z !== 'number') {
          return; // 데이터 포맷 안맞으면 스킵
        }

        const feedbackPerAxis = {
          x: { angle: angles.x, ...assessAxisRiskInternal(angles.x, NORMAL_RANGES.X), normalRange: NORMAL_RANGES.X },
          y: { angle: angles.y, ...assessAxisRiskInternal(angles.y, NORMAL_RANGES.Y), normalRange: NORMAL_RANGES.Y },
          z: { angle: angles.z, ...assessAxisRiskInternal(angles.z, NORMAL_RANGES.Z), normalRange: NORMAL_RANGES.Z },
        };
        const score = calculateOverallScoreInternal(feedbackPerAxis);
        allScores.push(score);
        periodTotalScore += score;
        validSamplesInPeriod++;

        // 문제점 카운트
        (['x', 'y', 'z'] as const).forEach(axisKey => {
          const axisData = feedbackPerAxis[axisKey];
          const problemKeyBase = `${axisKey.toUpperCase()}_${axisData.risk}`;
          const friendlyAxisName = axisKey === 'x' ? '목' : axisKey === 'y' ? '허리' : '몸통';

          if (axisData.risk === 'warning') {
            periodProblemCounts[axisKey].warning++;
            const desc = `${friendlyAxisName} 주의`;
            if (!problemCounter[problemKeyBase]) problemCounter[problemKeyBase] = { axis: axisKey.toUpperCase() as 'X'|'Y'|'Z', problemType: 'warning', description: desc, count: 0 };
            problemCounter[problemKeyBase].count++;
          } else if (axisData.risk === 'danger') {
            periodProblemCounts[axisKey].danger++;
            const desc = `${friendlyAxisName} 위험`;
            if (!problemCounter[problemKeyBase]) problemCounter[problemKeyBase] = { axis: axisKey.toUpperCase() as 'X'|'Y'|'Z', problemType: 'danger', description: desc, count: 0 };
            problemCounter[problemKeyBase].count++;
          }
        });
      });

      timeSeriesSummary.push({
        period: periodKey,
        avgScore: validSamplesInPeriod > 0 ? Math.round(periodTotalScore / validSamplesInPeriod) : null,
        totalSamples: validSamplesInPeriod,
        problemCounts: periodProblemCounts,
      });
    }
    
    // 시간 순으로 정렬 (groupKey가 문자열이라 시간 순 정렬이 보장되지 않을 수 있음)
    timeSeriesSummary.sort((a,b) => new Date(a.period).getTime() - new Date(b.period).getTime());

    const overallAverageScore = allScores.length > 0 ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : null;

    let scoreTrend: PostureHistoryResponse['scoreTrend'] = 'insufficient_data';
    if (timeSeriesSummary.length >= 2) {
      const firstScore = timeSeriesSummary[0].avgScore;
      const lastScore = timeSeriesSummary[timeSeriesSummary.length - 1].avgScore;
      if (firstScore !== null && lastScore !== null) {
        if (lastScore > firstScore) scoreTrend = 'improving';
        else if (lastScore < firstScore) scoreTrend = 'worsening';
        else scoreTrend = 'stable';
      }
    }

    const mostFrequentProblems = Object.values(problemCounter)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // 상위 5개 문제

    const responsePayload: PostureHistoryResponse = {
      requestedPeriod: { startDate: startDateStr, endDate: endDateStr, timeUnit },
      overallAverageScore,
      scoreTrend,
      timeSeriesSummary,
      mostFrequentProblems,
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('Error in GET /api/feedback/history:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posture history feedback', details: errorMessage },
      { status: 500 }
    );
  }
} 