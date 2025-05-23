//file app/api/cron/process-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runBatchProcessing, getProcessingStatus, reprocessDataRange } from '../../../../workers/dataProcessor';
import { connectToDatabase } from '../../../../lib/db/mongodb';

/**
 * 배치 처리 실행 API 엔드포인트
 * 
 * 이 API는 데이터 처리 워커를 수동으로 실행할 수 있는 엔드포인트를 제공합니다.
 * 실제 운영 환경에서는 보안을 위해 API 키나 인증 토큰으로 접근을 제한해야 합니다.
 */

// 응답 타입 정의
interface ProcessingResult {
  success: boolean;
  processedCount: number;
  skippedCount: number;
  errorCount: number;
  lastProcessedNumber: number;
  processingTime: number;
  errors: Array<{
    number: number;
    error: string;
  }>;
}

interface ProcessingStatus {
  lastRawDataNumber: number;
  lastAngleDataNumber: number;
  unprocessedCount: number;
  totalRawData: number;
  totalAngleData: number;
  processingLag: number;
}

/**
 * POST 요청 핸들러 - 배치 처리 실행
 * 
 * 배치 처리 작업을 수동으로 실행합니다. 다양한 옵션을 지원하여
 * 처리 방식을 유연하게 조정할 수 있습니다.
 * 
 * 요청 본문 예시:
 * {
 *   "batchSize": 200,
 *   "resetFilters": true,
 *   "filterParameters": {
 *     "processNoise": 0.01,
 *     "measurementNoise": 0.1
 *   },
 *   "reprocessRange": {
 *     "start": 1000,
 *     "end": 2000
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 간단한 보안 검사 (실제 운영에서는 더 강화된 인증 필요)
    const apiKey = request.headers.get('x-api-key');
    const authHeader = request.headers.get('authorization');
    
    if (process.env.NODE_ENV === 'production') {
      if (!apiKey && !authHeader) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      if (apiKey && apiKey !== process.env.CRON_API_KEY) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }
    }
    
    // 요청 본문 파싱 (선택적)
    let options: any = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch (error) {
      // JSON 파싱 오류는 무시하고 기본 옵션 사용
      console.log('No JSON body provided, using default options');
    }
    
    // 옵션 검증 및 기본값 설정
    const processingOptions = {
      batchSize: options.batchSize && options.batchSize > 0 ? Math.min(options.batchSize, 1000) : undefined,
      resetFiltersBeforeProcessing: Boolean(options.resetFilters),
      filterParameters: options.filterParameters || undefined,
      enableDetailedLogging: Boolean(options.detailedLogging) || process.env.NODE_ENV === 'development'
    };
    
    console.log(`Batch processing triggered via API at ${new Date().toISOString()}`);
    console.log('Processing options:', JSON.stringify(processingOptions, null, 2));
    
    let result: ProcessingResult;
    
    // 재처리 모드 확인
    if (options.reprocessRange && options.reprocessRange.start && options.reprocessRange.end) {
      const { start, end } = options.reprocessRange;
      
      if (start >= end || start < 0 || end < 0) {
        return NextResponse.json(
          { error: 'Invalid reprocess range. Start must be less than end and both must be positive.' },
          { status: 400 }
        );
      }
      
      console.log(`Reprocessing range: ${start} - ${end}`);
      result = await reprocessDataRange(start, end, {
        resetFiltersBeforeProcessing: processingOptions.resetFiltersBeforeProcessing,
        filterParameters: processingOptions.filterParameters
      });
      
    } else {
      // 일반 배치 처리 실행
      result = await runBatchProcessing(processingOptions);
    }
    
    // 기본 응답 데이터 구성
    const responseData: any = {
      success: result.success,
      timestamp: new Date().toISOString(),
      result: {
        processedCount: result.processedCount,
        skippedCount: result.skippedCount,
        errorCount: result.errorCount,
        lastProcessedNumber: result.lastProcessedNumber,
        processingTime: result.processingTime
      }
    };
    
    // 오류가 있는 경우 상세 정보 포함
    if (result.errorCount > 0 && result.errors && result.errors.length > 0) {
      responseData.result.errors = result.errors.slice(0, 10); // 최대 10개의 오류만 반환
      responseData.result.totalErrors = result.errors.length;
    }
    
    // 처리 후 상태 정보 추가
    try {
      const status = await getProcessingStatus();
      responseData.result.currentStatus = status;
    } catch (error) {
      console.warn('Failed to get processing status:', error);
    }
    
    const httpStatus = result.success ? 200 : 500;
    return NextResponse.json(responseData, { status: httpStatus });
    
  } catch (error) {
    console.error('Error in data processing API:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET 요청 핸들러 - 배치 처리 상태 조회
 * 
 * 현재 배치 처리 상태와 통계 정보를 조회합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';
    
    // 처리 상태 조회
    const status: ProcessingStatus = await getProcessingStatus();
    
    // 기본 응답 구성
    const response: any = {
      success: true,
      timestamp: new Date().toISOString(),
      status: {
        lastRawDataNumber: status.lastRawDataNumber,
        lastAngleDataNumber: status.lastAngleDataNumber,
        unprocessedCount: status.unprocessedCount,
        processingLag: status.processingLag,
        totalRawData: status.totalRawData,
        totalAngleData: status.totalAngleData
      }
    };
    // 상세 정보 포함 (요청한 경우)
    if (includeDetails) {
      // 처리 효율성 계산
      const processingEfficiency = status.totalRawData > 0 
        ? Math.round((status.totalAngleData / status.totalRawData) * 100) 
        : 0;
      
      // 예상 처리 시간 계산 (100개 배치 기준)
      const estimatedProcessingTime = Math.ceil(status.unprocessedCount / 100) * 2; // 2초 per 100 records
      
      response.details = {
        processingEfficiency: `${processingEfficiency}%`,
        estimatedProcessingTime: `${estimatedProcessingTime} seconds`,
        needsProcessing: status.unprocessedCount > 0,
        healthStatus: getProcessingHealthStatus(status),
        recommendations: getProcessingRecommendations(status)
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error getting processing status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get processing status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * PUT 요청 핸들러 - 배치 처리 설정 업데이트
 * 
 * 배치 처리 관련 설정을 업데이트합니다.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 설정 검증
    const validSettings = ['batchSize', 'filterParameters', 'autoProcessing'];
    const updates: any = {};
    
    for (const [key, value] of Object.entries(body)) {
      if (validSettings.includes(key)) {
        updates[key] = value;
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid settings provided' },
        { status: 400 }
      );
    }
    
    // 실제 설정 업데이트는 환경 변수나 데이터베이스를 통해 구현
    // 여기서는 응답만 시뮬레이션
    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      updates,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error updating processing settings:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE 요청 핸들러 - 처리된 데이터 정리
 * 
 * 오래된 처리 데이터를 삭제하여 저장 공간을 확보합니다.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '30');
    const dataType = searchParams.get('type') || 'both'; // 'raw', 'angle', 'both'
    const dryRun = searchParams.get('dryRun') === 'true';
    
    if (olderThanDays < 1 || olderThanDays > 365) {
      return NextResponse.json(
        { error: 'olderThanDays must be between 1 and 365' },
        { status: 400 }
      );
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const { db } = await connectToDatabase();
    const results: any = {
      success: true,
      dryRun,
      cutoffDate: cutoffDate.toISOString(),
      deleted: {}
    };
    
    // 원시 데이터 삭제/카운트
    if (dataType === 'raw' || dataType === 'both') {
      const rawQuery = { timestamp: { $lt: cutoffDate } };
      
      if (dryRun) {
        const rawCount = await db.collection('rawsensordata').countDocuments(rawQuery);
        results.deleted.rawSensorData = { wouldDelete: rawCount };
      } else {
        const rawResult = await db.collection('rawsensordata').deleteMany(rawQuery);
        results.deleted.rawSensorData = { deleted: rawResult.deletedCount };
      }
    }
    
    // 각도 데이터 삭제/카운트
    if (dataType === 'angle' || dataType === 'both') {
      const angleQuery = { timestamp: { $lt: cutoffDate } };
      
      if (dryRun) {
        const angleCount = await db.collection('angledata').countDocuments(angleQuery);
        results.deleted.angleData = { wouldDelete: angleCount };
      } else {
        const angleResult = await db.collection('angledata').deleteMany(angleQuery);
        results.deleted.angleData = { deleted: angleResult.deletedCount };
      }
    }
    
    return NextResponse.json(results);
    
  } catch (error) {
    console.error('Error in data cleanup:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Data cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 처리 상태의 건강도 평가
 */
function getProcessingHealthStatus(status: ProcessingStatus): {
  level: 'excellent' | 'good' | 'warning' | 'critical';
  message: string;
  color: string;
} {
  const lagRatio = status.totalRawData > 0 ? status.processingLag / status.totalRawData : 0;
  
  if (status.processingLag === 0) {
    return {
      level: 'excellent',
      message: '모든 데이터가 처리되었습니다',
      color: '#10B981'
    };
  } else if (lagRatio < 0.05) { // 5% 미만 지연
    return {
      level: 'good',
      message: '처리 상태가 양호합니다',
      color: '#22C55E'
    };
  } else if (lagRatio < 0.2) { // 20% 미만 지연
    return {
      level: 'warning',
      message: '처리 지연이 발생하고 있습니다',
      color: '#F59E0B'
    };
  } else {
    return {
      level: 'critical',
      message: '심각한 처리 지연이 발생했습니다',
      color: '#EF4444'
    };
  }
}


/**
 * 처리 상태에 따른 권장사항 생성
 */
function getProcessingRecommendations(status: ProcessingStatus): string[] {
  const recommendations: string[] = [];
  
  if (status.unprocessedCount === 0) {
    recommendations.push('모든 데이터가 최신 상태로 처리되었습니다.');
    return recommendations;
  }
  
  if (status.unprocessedCount > 1000) {
    recommendations.push('대량의 미처리 데이터가 있습니다. 배치 크기를 늘려서 처리하는 것을 고려하세요.');
  }
  
  if (status.processingLag > 500) {
    recommendations.push('처리 지연이 심각합니다. 시스템 리소스를 확인하고 배치 처리 빈도를 높이세요.');
  }
  
  const efficiency = status.totalRawData > 0 ? (status.totalAngleData / status.totalRawData) : 0;
  if (efficiency < 0.8) {
    recommendations.push('처리 효율성이 낮습니다. 오류 로그를 확인하고 실패한 데이터를 재처리하세요.');
  }
  
  if (status.unprocessedCount > 0 && status.unprocessedCount <= 100) {
    recommendations.push('소량의 미처리 데이터가 있습니다. 배치 처리를 실행하여 완료하세요.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push(`${status.unprocessedCount}개의 데이터가 처리 대기 중입니다.`);
  }
  
  return recommendations;
}