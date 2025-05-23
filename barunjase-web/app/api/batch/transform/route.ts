import { NextRequest, NextResponse } from 'next/server';
import { transformRawDataToAngleData, startPeriodicTransformation, stopPeriodicTransformation } from '../../../../lib/workers/dataTransformer';

/**
 * 배치 처리 API 엔드포인트
 * 
 * 이 API는 원시 데이터를 각도 데이터로 변환하는 배치 작업을 관리합니다.
 * 수동 실행, 자동 실행 시작/정지 기능을 제공합니다.
 */

// 워커 인터벌 ID를 저장하기 위한 변수 (메모리에 저장)
let workerIntervalId: NodeJS.Timeout | null = null;

/**
 * POST 요청 핸들러 - 배치 변환 작업 수동 실행
 * 
 * 파라미터:
 * - batchSize: 처리할 데이터 개수 (기본값: 100, 최대값: 1000)
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 파라미터 파싱
    const body = await request.json();
    const batchSize = Math.min(body.batchSize || 100, 1000);
    
    // 배치 작업 실행
    const result = await transformRawDataToAngleData(batchSize);
    
    // 결과 반환
    return NextResponse.json({
      success: true,
      message: 'Batch transformation completed',
      result
    });
    
  } catch (error) {
    console.error('Error executing batch transformation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute batch transformation',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT 요청 핸들러 - 주기적 배치 작업 시작
 * 
 * 파라미터:
 * - intervalMinutes: 실행 주기 (분, 기본값: 1)
 * - batchSize: 처리할 데이터 개수 (기본값: 100, 최대값: 1000)
 */
export async function PUT(request: NextRequest) {
  try {
    // 이미 실행 중인 워커 정지
    if (workerIntervalId) {
      stopPeriodicTransformation(workerIntervalId);
      workerIntervalId = null;
    }
    
    // 요청 파라미터 파싱
    const body = await request.json();
    const intervalMinutes = Math.max(body.intervalMinutes || 1, 1);
    const batchSize = Math.min(body.batchSize || 100, 1000);
    
    // 주기적 작업 시작
    workerIntervalId = startPeriodicTransformation(intervalMinutes, batchSize);
    
    // 결과 반환
    return NextResponse.json({
      success: true,
      message: `Periodic transformation started (interval: ${intervalMinutes} minutes, batch size: ${batchSize})`,
      config: {
        intervalMinutes,
        batchSize,
        isRunning: true
      }
    });
    
  } catch (error) {
    console.error('Error starting periodic transformation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start periodic transformation',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE 요청 핸들러 - 주기적 배치 작업 정지
 */
export async function DELETE() {
  try {
    if (workerIntervalId) {
      stopPeriodicTransformation(workerIntervalId);
      workerIntervalId = null;
      
      return NextResponse.json({
        success: true,
        message: 'Periodic transformation stopped',
        isRunning: false
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'No periodic transformation running',
        isRunning: false
      });
    }
    
  } catch (error) {
    console.error('Error stopping periodic transformation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to stop periodic transformation',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET 요청 핸들러 - 배치 작업 상태 조회
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    isRunning: workerIntervalId !== null
  });
} 