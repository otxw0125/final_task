import { config } from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드 - 최우선 실행
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

// 환경 변수 확인 (디버깅용)
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI를 찾을 수 없습니다.');
  console.error('환경 파일 경로:', envPath);
  console.error('파일 존재 여부:', require('fs').existsSync(envPath));
  process.exit(1);
}
  // 환경 변수가 로드되지 않은 경우 수동 설정


// ESM에서 메인 모듈 체크 방법
function isMainModule() {
  return import.meta.url === `file://${process.argv[1]}`;
}
// 환경 변수 로드 후 다른 모듈들 import
const { connectToDatabase } = await import('../lib/db/mongodb.js');
const { accelerationToAngle, resetFilters, setFilterParameters } = await import('../lib/algorithms/angleConverter.js');
const { RawSensorDataCollection } = await import('../lib/models/RawSensorData.js');
const { AngleDataCollection, createAngleData } = await import('../lib/models/AngleData.js');

/**
 * 데이터 처리 워커
 * 
 * 이 모듈은 원시 센서 데이터(RawSensorData)를 각도 데이터(AngleData)로 변환하는
 * 배치 처리 시스템을 구현합니다. 주기적으로 실행되어 미처리된 원시 데이터를
 * 찾아서 각도로 변환하고 저장합니다.
 */

// 배치 처리 설정
const BATCH_SIZE = 500; // 한 번에 처리할 데이터 수 (100 -> 500으로 증가)
const MAX_RETRY_ATTEMPTS = 3; // 실패 시 재시도 횟수
const RETRY_DELAY_MS = 1000; // 재시도 간격 (밀리초)

/**
 * 배치 처리 결과 인터페이스
 */
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

/**
 * 원시 센서 데이터를 각도 데이터로 변환하는 메인 배치 처리 함수
 */
export async function processRawData(options: {
  batchSize?: number;
  resetFiltersBeforeProcessing?: boolean;
  filterParameters?: { processNoise?: number; measurementNoise?: number };
} = {}): Promise<ProcessingResult> {
  
  const startTime = Date.now();
  const batchSize = options.batchSize || BATCH_SIZE;
  const errors: Array<{ number: number; error: string }> = [];
  
  try {
    console.log(`Starting batch processing at ${new Date().toISOString()}`);
    console.log(`Batch size: ${batchSize}`);
    
    // 데이터베이스 연결
    const { db } = await connectToDatabase();
    
    // 칼만 필터 설정
    if (options.resetFiltersBeforeProcessing) {
      console.log('Resetting Kalman filters...');
      resetFilters();
    }
    
    if (options.filterParameters) {
      console.log('Setting filter parameters:', options.filterParameters);
      setFilterParameters(
        options.filterParameters.processNoise,
        options.filterParameters.measurementNoise
      );
    }
    
    // 1. 마지막으로 처리된 AngleData의 number 조회
    const lastProcessedResult = await db.collection(AngleDataCollection)
      .find({})
      .sort({ number: -1 })
      .limit(1)
      .toArray();
    
    const lastProcessedNumber = lastProcessedResult.length > 0 ? lastProcessedResult[0].number : 0;
    console.log(`Last processed number: ${lastProcessedNumber}`);
    
    // 2. 아직 처리되지 않은 RawSensorData 조회
    const rawDataQuery = { number: { $gt: lastProcessedNumber } };
    const totalUnprocessed = await db.collection(RawSensorDataCollection).countDocuments(rawDataQuery);
    console.log(`Total unprocessed records: ${totalUnprocessed}`);
    
    if (totalUnprocessed === 0) {
      console.log('No new data to process');
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        lastProcessedNumber,
        processingTime: Date.now() - startTime,
        errors: []
      };
    }
    
    const rawData = await db.collection(RawSensorDataCollection)
      .find(rawDataQuery)
      .sort({ number: 1 })
      .limit(batchSize)
      .toArray();
    
    console.log(`Retrieved ${rawData.length} records for processing`);
    
    // 3. 각 원시 데이터를 각도 데이터로 변환
    const angleDataBatch = [];
    let processedCount = 0;
    let skippedCount = 0;
    let currentNumber = lastProcessedNumber;
    
    for (const item of rawData) {
      try {
        // 데이터 유효성 검사
        if (!item.accel || typeof item.accel.x !== 'number' || 
            typeof item.accel.y !== 'number' || typeof item.accel.z !== 'number') {
          console.warn(`Invalid acceleration data for record #${item.number}, skipping`);
          errors.push({ number: item.number, error: 'Invalid acceleration data format' });
          skippedCount++;
          continue;
        }
        
        // 유한한 값인지 확인
        const { x, y, z } = item.accel;
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
          console.warn(`Non-finite acceleration values for record #${item.number}, skipping`);
          errors.push({ number: item.number, error: 'Non-finite acceleration values' });
          skippedCount++;
          continue;
        }
        
        // 가속도 → 각도 변환
        const angles = accelerationToAngle(x, y, z);
        
        // 각도 데이터 객체 생성 (2축 시스템: X=좌우, Y=상하)
        const angleData = createAngleData(
          item.number,
          angles.X,      // X축: 좌우 기울기
          angles.Y,      // Y축: 상하 기울기 (목과 어깨에 부담)
          angles.X,      // 필터링된 X 값 (좌우)
          angles.Y,      // 필터링된 Y 값 (상하)
          calculateScore(angles), // 자세 점수 계산 (2축 기반)
          item.timestamp
        );
        
        angleDataBatch.push(angleData);
        processedCount++;
        currentNumber = Math.max(currentNumber, item.number);
        
        // 진행 상황 로깅 (100개마다)
        if (processedCount % 100 === 0) {
          console.log(`Processed ${processedCount} records...`);
        }
        
      } catch (error) {
        console.error(`Error processing record #${item.number}:`, error);
        errors.push({ 
          number: item.number, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        skippedCount++;
      }
    }
    
    // 4. 변환된 각도 데이터를 배치로 저장
    let saveAttempts = 0;
    let saveSuccess = false;
    
    while (saveAttempts < MAX_RETRY_ATTEMPTS && !saveSuccess && angleDataBatch.length > 0) {
      try {
        console.log(`Attempting to save ${angleDataBatch.length} angle data records (attempt ${saveAttempts + 1})`);
        
        const insertResult = await db.collection(AngleDataCollection).insertMany(angleDataBatch, {
          ordered: false // 일부 실패해도 계속 진행
        });
        
        console.log(`Successfully saved ${insertResult.insertedCount} angle data records`);
        saveSuccess = true;
        
      } catch (error: any) {
        saveAttempts++;
        console.error(`Save attempt ${saveAttempts} failed:`, error.message);
        
        // 중복 키 오류 처리
        if (error.code === 11000 && error.writeErrors) {
          console.log('Handling duplicate key errors...');
          const successfulInserts = angleDataBatch.length - error.writeErrors.length;
          console.log(`${successfulInserts} records saved, ${error.writeErrors.length} duplicates skipped`);
          saveSuccess = true;
          
          // 중복 오류 정보 추가
          error.writeErrors.forEach((writeError: any) => {
            if (writeError.err && writeError.err.op) {
              errors.push({
                number: writeError.err.op.number,
                error: 'Duplicate key - record already exists'
              });
            }
          });
        } else if (saveAttempts < MAX_RETRY_ATTEMPTS) {
          console.log(`Retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }
    
    if (!saveSuccess && angleDataBatch.length > 0) {
      throw new Error(`Failed to save data after ${MAX_RETRY_ATTEMPTS} attempts`);
    }
    
    const processingTime = Date.now() - startTime;
    const errorCount = errors.length;
    
    console.log(`Batch processing completed in ${processingTime}ms`);
    console.log(`Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
    
    // 5. 처리 결과 반환
    return {
      success: true,
      processedCount,
      skippedCount,
      errorCount,
      lastProcessedNumber: currentNumber,
      processingTime,
      errors
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Critical error in batch processing:', error);
    
    return {
      success: false,
      processedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      lastProcessedNumber: 0,
      processingTime,
      errors: [{ 
        number: -1, 
        error: error instanceof Error ? error.message : 'Unknown critical error' 
      }]
    };
  }
}

/**
 * 배치 처리 작업을 실행하는 메인 래퍼 함수
 */
export async function runBatchProcessing(options: {
  batchSize?: number;
  resetFiltersBeforeProcessing?: boolean;
  filterParameters?: { processNoise?: number; measurementNoise?: number };
  enableDetailedLogging?: boolean;
} = {}): Promise<ProcessingResult> {
  
  const enableDetailedLogging = options.enableDetailedLogging || process.env.NODE_ENV === 'development';
  
  try {
    if (enableDetailedLogging) {
      console.log('='.repeat(50));
      console.log('Starting batch processing job');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Options:', JSON.stringify(options, null, 2));
      console.log('='.repeat(50));
    }
    
    const result = await processRawData(options);
    
    if (enableDetailedLogging) {
      console.log('='.repeat(50));
      console.log('Batch processing completed');
      console.log('Result:', JSON.stringify(result, null, 2));
      console.log('='.repeat(50));
    }
    
    // 오류가 있었다면 상세 로깅
    if (result.errorCount > 0) {
      console.warn(`Processing completed with ${result.errorCount} errors:`);
      result.errors.forEach(error => {
        console.warn(`  Record #${error.number}: ${error.error}`);
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('Unhandled error in batch processing job:', error);
    throw error;
  }
}

/**
 * 데이터 처리 상태 정보 조회
 */
export async function getProcessingStatus(): Promise<{
  lastRawDataNumber: number;
  lastAngleDataNumber: number;
  unprocessedCount: number;
  totalRawData: number;
  totalAngleData: number;
  processingLag: number;
}> {
  try {
    const { db } = await connectToDatabase();
    
    // 최신 원시 데이터 번호 조회
    const lastRawResult = await db.collection(RawSensorDataCollection)
      .find({})
      .sort({ number: -1 })
      .limit(1)
      .toArray();
    const lastRawDataNumber = lastRawResult.length > 0 ? lastRawResult[0].number : 0;
    
    // 최신 각도 데이터 번호 조회
    const lastAngleResult = await db.collection(AngleDataCollection)
      .find({})
      .sort({ number: -1 })
      .limit(1)
      .toArray();
    const lastAngleDataNumber = lastAngleResult.length > 0 ? lastAngleResult[0].number : 0;
    
    // 전체 데이터 개수
    const totalRawData = await db.collection(RawSensorDataCollection).countDocuments();
    const totalAngleData = await db.collection(AngleDataCollection).countDocuments();
    
    // 미처리 데이터 개수
    const unprocessedCount = await db.collection(RawSensorDataCollection)
      .countDocuments({ number: { $gt: lastAngleDataNumber } });
    
    // 처리 지연 계산
    const processingLag = lastRawDataNumber - lastAngleDataNumber;
    
    return {
      lastRawDataNumber,
      lastAngleDataNumber,
      unprocessedCount,
      totalRawData,
      totalAngleData,
      processingLag
    };
    
  } catch (error) {
    console.error('Error getting processing status:', error);
    throw error;
  }
}

/**
 * 특정 범위의 데이터를 재처리하는 함수
 */
export async function reprocessDataRange(
  startNumber: number,
  endNumber: number,
  options: {
    resetFiltersBeforeProcessing?: boolean;
    filterParameters?: { processNoise?: number; measurementNoise?: number };
  } = {}
): Promise<ProcessingResult> {
  
  const startTime = Date.now();
  const errors: Array<{ number: number; error: string }> = [];
  
  try {
    console.log(`Starting reprocessing for range ${startNumber} - ${endNumber}`);
    
    const { db } = await connectToDatabase();
    
    // 칼만 필터 설정
    if (options.resetFiltersBeforeProcessing) {
      resetFilters();
    }
    
    if (options.filterParameters) {
      setFilterParameters(
        options.filterParameters.processNoise,
        options.filterParameters.measurementNoise
      );
    }
    
    // 지정된 범위의 원시 데이터 조회
    const rawData = await db.collection(RawSensorDataCollection)
      .find({ 
        number: { $gte: startNumber, $lte: endNumber }
      })
      .sort({ number: 1 })
      .toArray();
    
    console.log(`Retrieved ${rawData.length} records for reprocessing`);
    
    // 기존 각도 데이터 삭제
    const deleteResult = await db.collection(AngleDataCollection)
      .deleteMany({ 
        number: { $gte: startNumber, $lte: endNumber }
      });
    
    console.log(`Deleted ${deleteResult.deletedCount} existing angle data records`);
    
    // 새로운 각도 데이터 생성
    const angleDataBatch = [];
    let processedCount = 0;
    let skippedCount = 0;
    
    for (const item of rawData) {
      try {
        const { x, y, z } = item.accel;
        const angles = accelerationToAngle(x, y, z);
        
        const angleData = createAngleData(
          item.number,
          angles.X,
          angles.Y,
          angles.X,
          angles.Y,
          calculateScore(angles),
          item.timestamp
        );
        
        angleDataBatch.push(angleData);
        processedCount++;
        
      } catch (error) {
        console.error(`Error reprocessing record #${item.number}:`, error);
        errors.push({ 
          number: item.number, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        skippedCount++;
      }
    }
    
    // 새로운 각도 데이터 저장
    if (angleDataBatch.length > 0) {
      const insertResult = await db.collection(AngleDataCollection).insertMany(angleDataBatch);
      console.log(`Saved ${insertResult.insertedCount} reprocessed angle data records`);
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      processedCount,
      skippedCount,
      errorCount: errors.length,
      lastProcessedNumber: endNumber,
      processingTime,
      errors
    };
    
  } catch (error) {
    console.error('Error in reprocessing:', error);
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      processedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      lastProcessedNumber: startNumber,
      processingTime,
      errors: [{ 
        number: -1, 
        error: error instanceof Error ? error.message : 'Unknown reprocessing error' 
      }]
    };
  }
}

// 간단한 점수 계산 함수 (2축 시스템용: X=좌우, Y=상하)
function calculateScore(angles: { X: number, Y: number }): number {
  // 각 축별 점수 계산 (0-100 범위)
  // X축 (좌우): 정상 범위 ±15도, 목과 어깨에 부담
  const xScore = Math.max(0, 100 - Math.pow(Math.abs(angles.X) / 15, 1.5) * 100);
  
  // Y축 (상하): 정상 범위 ±20도, 허리에 부담이 가므로 더 중요하게 반영
  const yScore = Math.max(0, 100 - Math.pow(Math.abs(angles.Y) / 20, 1.5) * 100);
  
  // 가중 평균으로 종합 점수 계산 (상하가 더 중요)
  return Math.round(xScore * 0.3 + yScore * 0.7);
}

// 직접 실행 가능한 스크립트로 사용할 경우
if (isMainModule()) {
  console.log('Running data processor as standalone script...');
  
  // 명령줄 인수 파싱
  const args = process.argv.slice(2);
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--reset-filters':
        options.resetFiltersBeforeProcessing = true;
        break;
      case '--process-noise':
        options.filterParameters = options.filterParameters || {};
        options.filterParameters.processNoise = parseFloat(args[++i]);
        break;
      case '--measurement-noise':
        options.filterParameters = options.filterParameters || {};
        options.filterParameters.measurementNoise = parseFloat(args[++i]);
        break;
      case '--detailed-logging':
        options.enableDetailedLogging = true;
        break;
      case '--reprocess':
        options.reprocessMode = true;
        options.startNumber = parseInt(args[++i]);
        options.endNumber = parseInt(args[++i]);
        break;
      case '--status':
        options.statusOnly = true;
        break;
      case '--help':
        console.log(`
Usage: node dataProcessor.js [options]

Options:
  --batch-size <number>        Number of records to process in one batch (default: 100)
  --reset-filters              Reset Kalman filters before processing
  --process-noise <number>     Set process noise parameter for Kalman filter
  --measurement-noise <number> Set measurement noise parameter for Kalman filter
  --detailed-logging           Enable detailed logging output
  --reprocess <start> <end>    Reprocess data in specified range
  --status                     Show processing status only
  --help                       Show this help message

Examples:
  npm run process-status
  npm run process-data -- --batch-size 200 --reset-filters
  npm run process-reprocess -- 1000 2000
        `);
        process.exit(0);
    }
  }
  
  async function main() {
    try {
      if (options.statusOnly) {
        console.log('Fetching processing status...');
        const status = await getProcessingStatus();
        console.log('Processing Status:');
        console.log('='.repeat(40));
        console.log(`Last Raw Data Number: ${status.lastRawDataNumber}`);
        console.log(`Last Angle Data Number: ${status.lastAngleDataNumber}`);
        console.log(`Unprocessed Count: ${status.unprocessedCount}`);
        console.log(`Total Raw Data: ${status.totalRawData}`);
        console.log(`Total Angle Data: ${status.totalAngleData}`);
        console.log(`Processing Lag: ${status.processingLag}`);
        console.log('='.repeat(40));
        return;
      }
      
      let result: ProcessingResult;
      
      if (options.reprocessMode) {
        console.log(`Reprocessing data from ${options.startNumber} to ${options.endNumber}`);
        result = await reprocessDataRange(options.startNumber, options.endNumber, options);
      } else {
        result = await runBatchProcessing(options);
      }
      
      if (result.success) {
        console.log('Processing completed successfully!');
        process.exit(0);
      } else {
        console.error('Processing failed!');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Unhandled error in data processor:', error);
      process.exit(1);
    }
  }
  
  // 프로세스 종료 시그널 처리
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
  
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}