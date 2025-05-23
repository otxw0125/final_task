import { getAngleDataCollection } from '../db/collections';
import { AngleData } from '../models/AngleData';
import { 
    CurrentPostureFeedback, 
    // NORMAL_RANGES, RISK_THRESHOLDS, SCORE_WEIGHTS, MAX_DEVIATION_FOR_SCORE // 필요시 feedback.types.ts 등으로 분리
} from '../../app/api/feedback/current/route'; // 기존 타입 및 로직 활용
import { 
    PostureHistoryResponse, 
    PostureHistoryRequestParams, 
    TimeSegmentSummary,
    // DEFAULT_TIME_UNIT // 필요시 feedback.types.ts 등으로 분리
} from '../../app/api/feedback/history/route'; // 기존 타입 및 로직 활용
import { Filter, Sort } from 'mongodb';

// --- 환경 변수 또는 기본값으로 상수 설정 --- 
// app/api/feedback/current/route.ts 와 동일한 로직으로 환경변수/기본값 로드
// Helper function to parse JSON environment variables
function parseJsonEnvVariable<T>(envVar: string | undefined, defaultValue: T): T {
    if (envVar) {
      try {
        return JSON.parse(envVar) as T;
      } catch (error) {
        console.warn(`Failed to parse JSON from environment variable for server data fetching. Using default value. Error: ${error}`);
        return defaultValue;
      }
    }
    return defaultValue;
  }

const DEFAULT_NORMAL_RANGES = { 
  X: { min: -15, max: 15 }, // 상체 앞뒤 기울기 (0도: 등받이에 기댐, 양수: 앞으로 숙임)
  Y: { min: -10, max: 10 }, // 상체 좌우 기울기 (0도: 좌우 균형, 양수: 오른쪽으로 기울임)
  Z: { min: -10, max: 10 }  // 몸통 비틀림 (0도: 정면, 양수: 오른쪽 비틀림 가정)
};
const NORMAL_RANGES = parseJsonEnvVariable(process.env.FEEDBACK_NORMAL_RANGES, DEFAULT_NORMAL_RANGES);

const DEFAULT_RISK_THRESHOLDS = { warning: 5, danger: 15 };
const RISK_THRESHOLDS = parseJsonEnvVariable(process.env.FEEDBACK_RISK_THRESHOLDS, DEFAULT_RISK_THRESHOLDS);

const DEFAULT_SCORE_WEIGHTS = { X: 0.4, Y: 0.4, Z: 0.2 };
const SCORE_WEIGHTS = parseJsonEnvVariable(process.env.FEEDBACK_SCORE_WEIGHTS, DEFAULT_SCORE_WEIGHTS);

const MAX_DEVIATION_FOR_SCORE = parseInt(process.env.FEEDBACK_MAX_DEVIATION_FOR_SCORE || '30', 10);
const DEFAULT_HISTORY_TIME_UNIT = 'day';

// --- 현재 자세 피드백 로직 (current/route.ts 에서 가져옴) ---
interface ServerAxisFeedback {
    angle: number;
    risk: 'safe' | 'warning' | 'danger' | 'unknown';
    normalRange: { min: number; max: number };
    deviation?: number;
}

function assessAxisRiskForServer(angle: number, normalRange: { min: number; max: number }): { risk: ServerAxisFeedback['risk'], deviation: number } {
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

function calculateOverallScoreForServer(feedback: { x: ServerAxisFeedback; y: ServerAxisFeedback; z: ServerAxisFeedback }): number {
    let weightedScoreSum = 0;
    const calculateAxisContribution = (axisFeedback: ServerAxisFeedback, weight: number): number => {
        const penaltyRatio = Math.min(1, (axisFeedback.deviation || 0) / MAX_DEVIATION_FOR_SCORE);
        const axisScore = (1 - penaltyRatio) * 100;
        return axisScore * weight;
    };
    weightedScoreSum += calculateAxisContribution(feedback.x, SCORE_WEIGHTS.X);
    weightedScoreSum += calculateAxisContribution(feedback.y, SCORE_WEIGHTS.Y);
    weightedScoreSum += calculateAxisContribution(feedback.z, SCORE_WEIGHTS.Z);
    return Math.max(0, Math.min(100, Math.round(weightedScoreSum)));
}

function generateAdviceForServer(feedback: { x: ServerAxisFeedback; y: ServerAxisFeedback; z: ServerAxisFeedback }): { summary: string, details: string[] } {
    // current/route.ts의 generateAdvice 함수 로직과 유사하게 구현 (간략화된 버전 또는 그대로 가져오기)
    // 여기서는 간략화: 실제 프로덕션에서는 해당 로직을 공유하거나 정확히 일치시킴
    const problems: string[] = [];
    if (feedback.x.risk !== 'safe') problems.push(`상체 앞뒤 기울기(${feedback.x.risk})`);
    if (feedback.y.risk !== 'safe') problems.push(`상체 좌우 기울기(${feedback.y.risk})`);
    if (feedback.z.risk !== 'safe') problems.push(`몸통 비틀림(${feedback.z.risk})`);

    if (problems.length === 0) return { summary: "좋은 자세입니다.", details: ["계속 유지하세요."] };
    return { summary: `다음 부위에 주의하세요: ${problems.join(', ')}`, details: problems.map(p => `${p} 개선이 필요합니다.`) };
}

export async function getCurrentPostureFeedbackForServer(): Promise<CurrentPostureFeedback | null> {
    try {
        const collection = await getAngleDataCollection();
        const latestDataArray = await collection
            .find({}) // 필터 없이 모든 문서 대상
            .sort({ timestamp: -1 }) // 최신순 정렬
            .limit(1) // 가장 최신 1개
            .toArray();

        if (!latestDataArray || latestDataArray.length === 0) {
            // 데이터 없는 경우 기본값 반환 (기존 로직과 유사)
            return {
                timestamp: new Date().toISOString(),
                overallScore: 0,
                feedbackPerAxis: {
                    x: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.X, deviation: 0 },
                    y: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.Y, deviation: 0 },
                    z: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.Z, deviation: 0 },
                },
                summaryMessage: "최신 자세 데이터를 찾을 수 없습니다.",
                detailedAdvice: ["데이터가 없어 자세를 평가할 수 없습니다."],
                riskLevel: 'unknown',
            };
        }

        const latestAngleData = latestDataArray[0] as AngleData;

        // angles는 항상 있어야 함. 없으면 에러 처리 또는 기본값 반환
        if (!latestAngleData.angles || 
            typeof latestAngleData.angles.x !== 'number' || 
            typeof latestAngleData.angles.y !== 'number' || 
            typeof latestAngleData.angles.z !== 'number') {
            console.error('[feedback.ts] Fetched AngleData is missing valid angles information.');
            return {
                timestamp: new Date(latestAngleData.timestamp || Date.now()).toISOString(),
                overallScore: 0,
                feedbackPerAxis: {
                    x: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.X, deviation: 0 },
                    y: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.Y, deviation: 0 },
                    z: { angle: 0, risk: 'unknown', normalRange: NORMAL_RANGES.Z, deviation: 0 },
                },
                summaryMessage: "최신 자세 데이터의 각도 정보가 올바르지 않습니다.",
                detailedAdvice: ["데이터를 분석할 수 없습니다."],
                riskLevel: 'unknown',
            };
        }
        
        // feedbackPerAxis는 항상 angles로부터 실시간 계산 (일관성 유지)
        const feedbackPerAxis = {
            x: { angle: latestAngleData.angles.x, ...assessAxisRiskForServer(latestAngleData.angles.x, NORMAL_RANGES.X), normalRange: NORMAL_RANGES.X },
            y: { angle: latestAngleData.angles.y, ...assessAxisRiskForServer(latestAngleData.angles.y, NORMAL_RANGES.Y), normalRange: NORMAL_RANGES.Y },
            z: { angle: latestAngleData.angles.z, ...assessAxisRiskForServer(latestAngleData.angles.z, NORMAL_RANGES.Z), normalRange: NORMAL_RANGES.Z },
        };

        // AngleData에 저장된 평가 결과가 있는지 확인하고 우선 사용
        if (
            typeof latestAngleData.overallScore === 'number' &&
            latestAngleData.riskLevel &&
            latestAngleData.summaryMessage &&
            latestAngleData.detailedAdvice
        ) {
            return {
                timestamp: new Date(latestAngleData.timestamp).toISOString(),
                overallScore: latestAngleData.overallScore,
                riskLevel: latestAngleData.riskLevel,
                summaryMessage: latestAngleData.summaryMessage,
                detailedAdvice: latestAngleData.detailedAdvice,
                feedbackPerAxis: feedbackPerAxis as CurrentPostureFeedback['feedbackPerAxis'],
            };
        } else {
            // AngleData에 평가 결과가 없거나 일부만 있는 경우 (예: 과거 데이터), 실시간 평가
            console.warn(`[feedback.ts] Fetched AngleData (ID: ${latestAngleData._id}) is missing pre-calculated feedback. Falling back to live calculation.`);
            
            const overallScoreLive = calculateOverallScoreForServer(feedbackPerAxis);
            const adviceLive = generateAdviceForServer(feedbackPerAxis); 

            let riskLevelLive: CurrentPostureFeedback['riskLevel'] = 'safe';
            if (feedbackPerAxis.x.risk === 'danger' || feedbackPerAxis.y.risk === 'danger' || feedbackPerAxis.z.risk === 'danger') {
                riskLevelLive = 'danger';
            } else if (feedbackPerAxis.x.risk === 'warning' || feedbackPerAxis.y.risk === 'warning' || feedbackPerAxis.z.risk === 'warning') {
                riskLevelLive = 'warning';
            }
            
            return {
                timestamp: new Date(latestAngleData.timestamp).toISOString(),
                overallScore: overallScoreLive,
                riskLevel: riskLevelLive, 
                summaryMessage: adviceLive.summary,
                detailedAdvice: adviceLive.details,
                feedbackPerAxis: feedbackPerAxis as CurrentPostureFeedback['feedbackPerAxis'],
            };
        }

    } catch (error) {
        console.error('Error in getCurrentPostureFeedbackForServer:', error);
        return null;
    }
}

// --- 자세 히스토리 로직 (history/route.ts 에서 가져옴) ---
export async function getPostureHistoryForServer(params: PostureHistoryRequestParams): Promise<PostureHistoryResponse | null> {
    const { startDate: startDateStr, endDate: endDateStr, timeUnit = DEFAULT_HISTORY_TIME_UNIT } = params;

    try {
        if (!startDateStr || !endDateStr) throw new Error('startDate and endDate are required for history.');
        
        let startDate: Date, endDate: Date;
        try {
            startDate = new Date(startDateStr);
            endDate = new Date(endDateStr);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error('Invalid date format for history');
            if (startDate > endDate) throw new Error('startDate cannot be after endDate for history');
        } catch (e: any) {
            console.error('Date parsing error in getPostureHistoryForServer:', e);
            throw e; 
        }
        endDate.setHours(23, 59, 59, 999);

        const collection = await getAngleDataCollection();
        const query: Filter<AngleData> = {
            timestamp: { $gte: startDate, $lte: endDate },
            'angles.x': { $type: "number" },
            'angles.y': { $type: "number" },
            'angles.z': { $type: "number" },
        };
        const sort: Sort = { timestamp: 1 };
        const historicalData = await collection.find(query).sort(sort).toArray();

        if (historicalData.length === 0) {
            return {
                requestedPeriod: { startDate: startDateStr, endDate: endDateStr, timeUnit },
                overallAverageScore: null,
                scoreTrend: 'insufficient_data',
                timeSeriesSummary: [],
                mostFrequentProblems: [],
            };
        }

        const timeSeriesSummary: TimeSegmentSummary[] = [];
        const allScores: number[] = [];
        const problemCounterForServer: Record<string, { axis: 'X' | 'Y' | 'Z'; problemType: 'warning' | 'danger'; description: string; count: number }> = {};

        const groupedData: Record<string, AngleData[]> = {};
        historicalData.forEach(record => {
            if (!record.timestamp || !record.angles) return;
            const recordDate = new Date(record.timestamp);
            let groupKey = '';
            if (timeUnit === 'hour') {
                groupKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}T${String(recordDate.getHours()).padStart(2, '0')}:00:00.000Z`;
            } else {
                groupKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
            }
            if (!groupedData[groupKey]) groupedData[groupKey] = [];
            groupedData[groupKey].push(record);
        });

        for (const periodKey in groupedData) {
            const group = groupedData[periodKey];
            let periodTotalScore = 0;
            let validSamplesInPeriod = 0;
            const periodProblemCounts = { x: { warning: 0, danger: 0 }, y: { warning: 0, danger: 0 }, z: { warning: 0, danger: 0 } };

            group.forEach(item => {
                const angles = item.angles;
                if (typeof angles?.x !== 'number' || typeof angles?.y !== 'number' || typeof angles?.z !== 'number') return;

                const feedbackPerAxis = {
                    x: { angle: angles.x, ...assessAxisRiskForServer(angles.x, NORMAL_RANGES.X), normalRange: NORMAL_RANGES.X },
                    y: { angle: angles.y, ...assessAxisRiskForServer(angles.y, NORMAL_RANGES.Y), normalRange: NORMAL_RANGES.Y },
                    z: { angle: angles.z, ...assessAxisRiskForServer(angles.z, NORMAL_RANGES.Z), normalRange: NORMAL_RANGES.Z },
                };
                const score = calculateOverallScoreForServer(feedbackPerAxis as any); // `as any` for simplicity, ensure types match
                allScores.push(score);
                periodTotalScore += score;
                validSamplesInPeriod++;

                (['x', 'y', 'z'] as const).forEach(axisKey => {
                    const axisData = feedbackPerAxis[axisKey];
                    const problemKeyBase = `${axisKey.toUpperCase()}_${axisData.risk}`;
                    const friendlyAxisName = axisKey === 'x' ? '목' : axisKey === 'y' ? '허리' : '몸통';
                    if (axisData.risk === 'warning' || axisData.risk === 'danger') {
                        const desc = `${friendlyAxisName} ${axisData.risk === 'warning' ? '주의' : '위험'}`;
                        if (!problemCounterForServer[problemKeyBase]) problemCounterForServer[problemKeyBase] = { axis: axisKey.toUpperCase() as 'X'|'Y'|'Z', problemType: axisData.risk, description: desc, count: 0 };
                        problemCounterForServer[problemKeyBase].count++;
                        periodProblemCounts[axisKey][axisData.risk]++;
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
        const mostFrequentProblems = Object.values(problemCounterForServer).sort((a, b) => b.count - a.count).slice(0, 5);

        return {
            requestedPeriod: { startDate: startDateStr, endDate: endDateStr, timeUnit },
            overallAverageScore,
            scoreTrend,
            timeSeriesSummary,
            mostFrequentProblems,
        };

    } catch (error) {
        console.error('Error in getPostureHistoryForServer:', error);
        return null;
    }
} 