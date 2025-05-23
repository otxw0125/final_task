import { NextResponse } from 'next/server';
import { ensureIndexes } from '../../../lib/db/collections';
// 임시로 주석 처리하여 초기화 과정을 단순화
// import { startPeriodicTransformation } from '../../../lib/workers/dataTransformer';

/**
 * 서버 시작 초기화 API 엔드포인트
 * 
 * 이 API는 서버가 시작될 때 자동으로 호출되어 필요한 초기화 작업을 수행합니다:
 * 1. 데이터베이스 인덱스 생성
 * 2. 배치 처리 워커 시작 (현재 비활성화됨)
 * 
 * 서버가 시작될 때 _app.tsx 또는 _middleware.ts에서 호출해야 합니다.
 */

// 초기화 상태 추적
let isInitialized = false;
let workerIntervalId: NodeJS.Timeout | null = null;

/**
 * GET 요청 핸들러 - 서버 초기화
 */
export async function GET() {
  try {
    if (!isInitialized) {
      // 1. 데이터베이스 인덱스 생성
      await ensureIndexes();
      console.log('Database indexes ensured');
      
      // 2. 배치 처리 워커 시작 (임시 비활성화)
      /*
      if (!workerIntervalId) {
        workerIntervalId = startPeriodicTransformation(5, 200);
        console.log('Periodic data transformation started (interval: 5 minutes, batch size: 200)');
      }
      */
      
      isInitialized = true;
      
      return NextResponse.json({
        success: true,
        message: 'Server initialized successfully (worker disabled)',
        initialized: {
          database: true,
          workers: false
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Server already initialized',
        initialized: {
          database: true,
          workers: workerIntervalId !== null
        }
      });
    }
    
  } catch (error) {
    console.error('Error during server initialization:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize server',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
        initialized: {
          database: isInitialized,
          workers: workerIntervalId !== null
        }
      },
      { status: 500 }
    );
  }
} 