/**
 * 자세 점수 API 라우트
 * 
 * 이 파일은 자세 점수 데이터를 조회하고 관리하는 API 엔드포인트를 구현합니다.
 * - GET: 자세 점수 히스토리 조회
 * - POST: 새 자세 점수 데이터 저장
 * 
 * @author GitHub Copilot
 * @date 2025-05-21
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAngleDataCollection } from '@/lib/db/collections';
import { AngleData } from '@/lib/models/AngleData';
import { createPostureScore, PostureScore } from '@/lib/models/PostureScore';

// import { MongoClient } from 'mongodb'; // 이 줄 제거
import { connectToDatabase } from '@/lib/db/mongodb';

/**
 * 자세 점수를 계산하는 함수
 * @param angleData 각도 데이터
 * @returns 계산된 자세 점수와 피드백
 */
function calculatePostureScore(angleData: AngleData): {
  score: number;
  neckScore: number;
  backScore: number;
  rotationScore: number;
  feedback: string;
} {
  // 이상적인 각도 범위 정의
  const IDEAL_X_RANGE = { min: -10, max: 10 };  // 목 기울기 (피치)
  const IDEAL_Y_RANGE = { min: -5, max: 5 };    // 허리 기울기 (롤)
  const IDEAL_Z_RANGE = { min: -5, max: 5 };    // 회전 (요)
  
  // 실제 각도 값 (앉은 자세에서는 x, y만 사용)
  const { x: X, y: Y } = angleData.angles;
  const Z = 0; // 앉은 자세에서는 회전(Z축) 값을 0으로 고정
  
  // 각 축별 점수 계산 (0-100)
  let neckScore = 100;
  let backScore = 100;
  let rotationScore = 100;
  
  // X축 점수 계산 (목 기울기)
  if (X < IDEAL_X_RANGE.min) {
    // 목이 뒤로 기울어짐 (최대 40점 감소)
    neckScore -= Math.min(40, Math.abs(X - IDEAL_X_RANGE.min) * 2);
  } else if (X > IDEAL_X_RANGE.max) {
    // 목이 앞으로 기울어짐 (최대 80점 감소, 더 심각한 문제)
    neckScore -= Math.min(80, Math.abs(X - IDEAL_X_RANGE.max) * 4);
  }
  
  // Y축 점수 계산 (허리 기울기)
  if (Y < IDEAL_Y_RANGE.min) {
    // 허리가 한쪽으로 기울어짐 (최대 60점 감소)
    backScore -= Math.min(60, Math.abs(Y - IDEAL_Y_RANGE.min) * 3);
  } else if (Y > IDEAL_Y_RANGE.max) {
    // 허리가 반대쪽으로 기울어짐 (최대 60점 감소)
    backScore -= Math.min(60, Math.abs(Y - IDEAL_Y_RANGE.max) * 3);
  }
  
  // Z축 점수 계산 (회전)
  if (Z < IDEAL_Z_RANGE.min || Z > IDEAL_Z_RANGE.max) {
    // 좌우 회전 (최대 40점 감소)
    rotationScore -= Math.min(40, Math.abs(Z - (Z < 0 ? IDEAL_Z_RANGE.min : IDEAL_Z_RANGE.max)) * 2);
  }
  
  // 가중치 적용하여 종합 점수 계산
  // 목: 40%, 허리: 40%, 회전: 20%
  const totalScore = Math.round(neckScore * 0.4 + backScore * 0.4 + rotationScore * 0.2);
  
  // 피드백 메시지 생성
  let feedback = '';
  
  if (totalScore >= 90) {
    feedback = '자세가 매우 좋습니다! 계속 유지하세요.';
  } else if (totalScore >= 70) {
    feedback = '대체로 좋은 자세입니다.';
    
    // 세부 피드백 추가
    if (X > IDEAL_X_RANGE.max + 5) {
      feedback += ' 목이 앞으로 숙여져 있습니다. 턱을 약간 들어보세요.';
    }
    if (Y > IDEAL_Y_RANGE.max + 5) {
      feedback += ' 허리를 좀 더 바르게 세워보세요.';
    }
  } else if (totalScore >= 50) {
    feedback = '자세를 개선할 필요가 있습니다.';
    
    if (X > IDEAL_X_RANGE.max + 10) {
      feedback += ' 목이 많이 앞으로 숙여져 있습니다. 모니터 높이를 조정해보세요.';
    }
    if (Math.abs(Y) > IDEAL_Y_RANGE.max + 10) {
      feedback += ' 허리가 많이 구부러져 있습니다. 의자 높이를 조정하고 바른 자세를 취하세요.';
    }
    if (Math.abs(Z) > IDEAL_Z_RANGE.max + 8) {
      feedback += ' 좌우 균형이 맞지 않습니다. 정면을 바라보세요.';
    }
  } else {
    feedback = '자세가 좋지 않습니다. 지금 바로 자세를 교정하세요!';
    
    if (X > IDEAL_X_RANGE.max + 15) {
      feedback += ' 목이 심하게 앞으로 숙여져 있습니다. 잠시 휴식을 취하고 스트레칭을 하세요.';
    }
    if (Math.abs(Y) > IDEAL_Y_RANGE.max + 15) {
      feedback += ' 허리가 심하게 구부러져 있습니다. 허리를 펴고 바른 자세를 취하세요.';
    }
  }
  
  return { 
    score: totalScore,
    neckScore,
    backScore,
    rotationScore,
    feedback
  };
}

/**
 * GET 요청 처리 - 자세 점수 히스토리 조회
 * @param request NextRequest 객체
 * @returns 자세 점수 히스토리
 */
export async function GET(request: NextRequest) {
  try {
    // URL에서 쿼리 파라미터 추출
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50; // 기본값 50개
    
    // 시간 범위 파라미터
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    // MongoDB 연결
    const { db } = await connectToDatabase();
    const collection = db.collection('posturescore');
    
    // 쿼리 조건 생성 - any 타입 대신 구체적인 타입 사용
    const query: { timestamp?: { $gte?: Date; $lte?: Date } } = {};
    
    // 시간 범위 조건 추가
    if (fromParam || toParam) {
      query.timestamp = {};
      
      if (fromParam) {
        const fromDate = new Date(fromParam);
        if (!isNaN(fromDate.getTime())) {
          query.timestamp.$gte = fromDate;
        }
      }
      
      if (toParam) {
        const toDate = new Date(toParam);
        if (!isNaN(toDate.getTime())) {
          query.timestamp.$lte = toDate;
        }
      }
    }
    
    // 데이터 조회
    const data = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    // 데이터 집계를 위한 통계 계산
    let stats = null;
    
    if (data.length > 0) {
      const scores = data.map(item => item.score);
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      // 일일 평균 계산을 위한 데이터 정리
      const dailyScores: { [date: string]: number[] } = {};
      
      data.forEach(item => {
        const date = new Date(item.timestamp).toISOString().split('T')[0];
        if (!dailyScores[date]) {
          dailyScores[date] = [];
        }
        dailyScores[date].push(item.score);
      });
      
      // 일일 평균 계산
      const dailyAverages = Object.entries(dailyScores).map(([date, scores]) => {
        const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        return { date, average: Math.round(avg) };
      });
      
      stats = {
        count: data.length,
        average: Math.round(avgScore),
        min: Math.min(...scores),
        max: Math.max(...scores),
        dailyAverages
      };
    }
    
    // 결과 반환
    return NextResponse.json({ 
      count: data.length,
      data,
      stats
    });
  } catch (error: unknown) {
    console.error('자세 점수 조회 중 오류 발생:', error);
    
    return NextResponse.json(
      { error: '자세 점수 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST 요청 처리 - 최신 각도 데이터로부터 자세 점수 계산 및 저장
 * @param request NextRequest 객체
 * @returns 처리 결과
 */
export async function POST(request: NextRequest) {
  try {
    // 각도 데이터 컬렉션 가져오기
    const angleCollection = await getAngleDataCollection();
    
    // 최신 각도 데이터 조회
    const latestData = await angleCollection
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    
    // 데이터가 없는 경우
    if (latestData.length === 0) {
      return NextResponse.json(
        { error: '각도 데이터가 없습니다. 센서 데이터를 먼저 수집하세요.' },
        { status: 404 }
      );
    }
    
    const angleData = latestData[0] as AngleData;
    
    // sensorDataNumber가 undefined인 경우 처리
    if (angleData.sensorDataNumber === undefined) {
      return NextResponse.json(
        { error: '각도 데이터에 sensorDataNumber가 없습니다.' },
        { status: 400 }
      );
    }
    
    // 자세 점수 계산
    const { score, neckScore, backScore, rotationScore, feedback } = calculatePostureScore(angleData);
    
    // PostureScore 객체 생성
    const postureScore = createPostureScore(
      angleData.sensorDataNumber,
      score,
      neckScore,
      backScore,
      rotationScore,
      feedback,
      typeof angleData.timestamp === 'string' ? new Date(angleData.timestamp) : angleData.timestamp
    );
    
    // MongoDB에 저장
    const { db } = await connectToDatabase();
    const collection = db.collection('posturescore');
    
    // 중복 체크 (동일한 number가 있는 경우)
    const existingScore = await collection.findOne({ number: postureScore.number });
    
    if (existingScore) {
      // 업데이트
      await collection.updateOne(
        { number: postureScore.number },
        { $set: postureScore }
      );
      
      return NextResponse.json({
        success: true,
        message: '자세 점수가 업데이트되었습니다.',
        data: postureScore
      });
    } else {
      // 새 데이터 삽입
      const result = await collection.insertOne(postureScore);
      
      return NextResponse.json({
        success: true,
        message: '자세 점수가 성공적으로 저장되었습니다.',
        data: postureScore,
        id: result.insertedId
      }, { status: 201 });
    }
  } catch (error: unknown) {
    console.error('자세 점수 저장 중 오류 발생:', error);
    
    return NextResponse.json(
      { error: '자세 점수 저장 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 각도 데이터로부터 자세 점수를 계산하는 유틸리티 함수
 * sensor-data/raw에서도 사용할 수 있도록 export
 */
export { calculatePostureScore };
