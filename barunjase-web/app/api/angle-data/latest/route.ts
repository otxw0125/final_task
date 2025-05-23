//file app/api/angle-data/latest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAngleDataCollection } from '../../../../lib/db/collections';
import { AngleData } from '../../../../lib/models/AngleData';
import { isAngleWithinNormalRange, formatAngleResult } from '../../../../lib/algorithms/angleConverter';

/**
 * 각도 데이터 조회 API 엔드포인트
 * 
 * 이 API는 변환된 각도 데이터를 조회하고 자세 점수를 계산합니다.
 * 캐싱을 적용하여 성능을 최적화하고, 실시간에 가까운 응답을 제공합니다.
 */

// AngleData 모델의 angles 속성을 AngleResult 형식으로 변환하는 어댑터 함수
function anglesAdapter(angles: { x: number, y: number, z: number }) {
  return {
    X: angles.x,
    Y: angles.y,
    Z: angles.z
  };
}

// 메모리 캐시 (최근 데이터)
interface CachedData {
  data: any;
  timestamp: number;
  score: number;
  isNormalPosture: boolean;
}

let latestDataCache: CachedData | null = null;
const CACHE_TTL = 3000; // 3초 (프로토타입에서는 빠른 업데이트)

/**
 * GET 요청 핸들러 - 최신 각도 데이터 조회
 * 
 * 최신 각도 데이터를 조회하고 자세 점수를 계산하여 반환합니다.
 * 캐싱을 적용하여 성능을 최적화합니다.
 * 
 * 쿼리 파라미터:
 * - includeHistory: 최근 N개의 데이터를 함께 반환 (기본값: false)
 * - historyCount: includeHistory가 true일 때 반환할 이력 개수 (기본값: 5)
 * - skipCache: 캐시를 무시하고 데이터베이스에서 직접 조회 (기본값: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyCount = Math.min(parseInt(searchParams.get('historyCount') || '5'), 50);
    const skipCache = searchParams.get('skipCache') === 'true';
    
    // 캐시된 데이터 확인 (이력이 필요하지 않고 캐시를 건너뛰지 않는 경우에만)
    const now = Date.now();
    if (!includeHistory && !skipCache && latestDataCache && 
        (now - latestDataCache.timestamp) < CACHE_TTL) {
      
      return NextResponse.json({
        success: true,
        data: latestDataCache.data,
        score: latestDataCache.score,
        isNormalPosture: latestDataCache.isNormalPosture,
        cached: true,
        cacheAge: now - latestDataCache.timestamp
      });
    }
    
    // 캐시 미스 또는 이력 요청: 데이터베이스에서 조회
    const collection = await getAngleDataCollection();
    
    // 최신 데이터 조회
    const limit = includeHistory ? historyCount : 1;
    const latestData = await collection
      .find({})
      .sort({ timestamp: -1, number: -1 })
      .limit(limit)
      .toArray();
    
    if (latestData.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No angle data found',
          message: 'No processed angle data available. Please ensure raw sensor data has been processed.'
        },
        { status: 404 }
      );
    }
    
    // 최신 데이터에 대한 상세 정보 계산
    const mostRecent = latestData[0];
    const angleResult = anglesAdapter(mostRecent.angles);
    const postureScore = calculatePostureScore(angleResult);
    const isNormalPosture = isAngleWithinNormalRange(angleResult);
    const formattedAngles = formatAngleResult(angleResult);
    
    // 응답 데이터 구성
    const responseData = {
      ...mostRecent,
      score: postureScore.total,
      scoreBreakdown: postureScore.breakdown,
      isNormalPosture,
      formattedAngles,
      riskLevel: getRiskLevel(postureScore.total),
      recommendations: getPostureRecommendations(angleResult, postureScore.total)
    };
    
    // 캐시 업데이트 (이력 요청이 아닌 경우에만)
    if (!includeHistory) {
      latestDataCache = {
        data: responseData,
        timestamp: now,
        score: postureScore.total,
        isNormalPosture
      };
    }
    
    // 이력 데이터 포함하여 응답
    const response: any = {
      success: true,
      data: responseData,
      cached: false
    };
    
    if (includeHistory && latestData.length > 1) {
      response.history = latestData.slice(1).map(item => {
        const itemAngleResult = anglesAdapter(item.angles);
        return {
          ...item,
          score: calculatePostureScore(itemAngleResult).total,
          isNormalPosture: isAngleWithinNormalRange(itemAngleResult)
        };
      });
      
      // 트렌드 분석 추가
      response.trend = analyzePostureTrend(latestData);
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching latest angle data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch latest angle data',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * 자세 점수 계산 함수
 * 
 * 각도 데이터를 기반으로 0-100 범위의 자세 점수를 계산합니다.
 * 점수가 높을수록 좋은 자세를 의미합니다.
 * 
 * @param angle 각도 데이터 객체 (X, Y, Z)
 * @returns 자세 점수 및 세부 점수
 */
function calculatePostureScore(angle: { X: number, Y: number, Z: number }) {
  // 각 축별 점수 계산 (0-100 범위)
  
  // X축 기울기 스코어 (목 기울기) - 45도를 최대 편차로 설정
  const xScore = Math.max(0, 100 - Math.pow(Math.abs(angle.X) / 45, 1.5) * 100);
  
  // Y축 기울기 스코어 (허리 기울기) - 30도를 최대 편차로 설정
  const yScore = Math.max(0, 100 - Math.pow(Math.abs(angle.Y) / 30, 1.5) * 100);
  
  // Z축 기울기 스코어 (회전) - 30도를 최대 편차로 설정
  const zScore = Math.max(0, 100 - Math.pow(Math.abs(angle.Z) / 30, 1.5) * 100);
  
  // 가중 평균으로 종합 점수 계산
  // 목과 허리가 더 중요하므로 각각 40%씩, 회전은 20%
  const totalScore = Math.round(xScore * 0.4 + yScore * 0.4 + zScore * 0.2);
  
  return {
    total: totalScore,
    breakdown: {
      neck: Math.round(xScore),      // 목 기울기 점수
      back: Math.round(yScore),      // 허리 기울기 점수
      rotation: Math.round(zScore),  // 회전 점수
      weights: {
        neck: 0.4,
        back: 0.4,
        rotation: 0.2
      }
    }
  };
}

/**
 * 자세 위험도 레벨 결정
 * 
 * @param score 자세 점수 (0-100)
 * @returns 위험도 레벨 정보
 */
function getRiskLevel(score: number): {
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  label: string;
  color: string;
  description: string;
} {
  if (score >= 90) {
    return {
      level: 'excellent',
      label: '매우 좋음',
      color: '#10B981', // 초록색
      description: '완벽한 자세를 유지하고 있습니다.'
    };
  } else if (score >= 75) {
    return {
      level: 'good',
      label: '좋음',
      color: '#22C55E', // 연한 초록색
      description: '좋은 자세입니다. 현재 상태를 유지하세요.'
    };
  } else if (score >= 60) {
    return {
      level: 'fair',
      label: '보통',
      color: '#FCD34D', // 노란색
      description: '자세 개선이 필요합니다.'
    };
  } else if (score >= 40) {
    return {
      level: 'poor',
      label: '나쁨',
      color: '#F97316', // 주황색
      description: '자세가 좋지 않습니다. 즉시 교정이 필요합니다.'
    };
  } else {
    return {
      level: 'critical',
      label: '매우 나쁨',
      color: '#EF4444', // 빨간색
      description: '매우 나쁜 자세입니다. 긴급한 교정이 필요합니다.'
    };
  }
}

/**
 * 자세 개선 권장사항 생성
 * 
 * @param angle 각도 데이터
 * @param score 자세 점수
 * @returns 권장사항 배열
 */
function getPostureRecommendations(
  angle: { X: number, Y: number, Z: number },
  score: number
): string[] {
  const recommendations: string[] = [];
  
  // 점수가 좋으면 칭찬 메시지
  if (score >= 85) {
    recommendations.push('훌륭한 자세를 유지하고 있습니다! 계속 이 상태를 유지하세요.');
    return recommendations;
  }
  
  // X축 (목 기울기) 관련 권장사항
  if (Math.abs(angle.X) > 20) {
    if (angle.X > 0) {
      recommendations.push('목이 앞으로 숙여져 있습니다. 턱을 당기고 목을 곧게 세우세요.');
    } else {
      recommendations.push('목이 뒤로 젖혀져 있습니다. 자연스러운 자세로 목을 앞으로 가져오세요.');
    }
  }
  
  // Y축 (허리 기울기) 관련 권장사항
  if (Math.abs(angle.Y) > 15) {
    if (angle.Y > 0) {
      recommendations.push('허리가 오른쪽으로 기울어져 있습니다. 왼쪽으로 몸을 바로 세우세요.');
    } else {
      recommendations.push('허리가 왼쪽으로 기울어져 있습니다. 오른쪽으로 몸을 바로 세우세요.');
    }
  }
  
  // Z축 (회전) 관련 권장사항
  if (Math.abs(angle.Z) > 10) {
    recommendations.push('몸이 회전되어 있습니다. 어깨를 평행하게 맞추고 정면을 바라보세요.');
  }
  
  // 전반적인 권장사항
  if (score < 60) {
    recommendations.push('전체적인 자세 교정이 필요합니다. 등받이에 기대어 앉고 발을 바닥에 평평하게 놓으세요.');
    recommendations.push('모니터는 눈높이에 맞추고, 키보드와 마우스는 팔꿈치가 90도가 되도록 조정하세요.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('약간의 자세 개선이 필요합니다. 허리를 곧게 펴고 어깨의 힘을 빼세요.');
  }
  
  return recommendations;
}

/**
 * 자세 트렌드 분석
 * 
 * @param dataPoints 최근 데이터 포인트들
 * @returns 트렌드 분석 결과
 */
function analyzePostureTrend(dataPoints: AngleData[]): {
  direction: 'improving' | 'stable' | 'declining';
  averageScore: number;
  scoreChange: number;
  consistency: number;
} {
  if (dataPoints.length < 2) {
    return {
      direction: 'stable',
      averageScore: 0,
      scoreChange: 0,
      consistency: 0
    };
  }
  
  // 각 포인트의 점수 계산
  const scores = dataPoints.map(point => {
    const angleResult = anglesAdapter(point.angles);
    return calculatePostureScore(angleResult).total;
  });
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  // 최근 점수와 이전 점수들의 평균 비교
  const recentScore = scores[0];
  const previousAverage = scores.slice(1).reduce((sum, score) => sum + score, 0) / (scores.length - 1);
  const scoreChange = recentScore - previousAverage;
  
  // 일관성 계산 (표준편차의 역수)
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / scores.length;
  const standardDeviation = Math.sqrt(variance);
  const consistency = Math.max(0, 100 - standardDeviation);
  
  // 트렌드 방향 결정
  let direction: 'improving' | 'stable' | 'declining';
  if (scoreChange > 5) {
    direction = 'improving';
  } else if (scoreChange < -5) {
    direction = 'declining';
  } else {
    direction = 'stable';
  }
  
  return {
    direction,
    averageScore: Math.round(averageScore),
    scoreChange: Math.round(scoreChange),
    consistency: Math.round(consistency)
  };
}