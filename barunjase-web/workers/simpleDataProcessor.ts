/**
 * 간소화된 데이터 처리 워커
 * 
 * 이 모듈은 원시 센서 데이터(RawSensorData)를 각도 데이터(AngleData)로 변환하는
 * 배치 처리 시스템을 구현합니다.
 */

import { connectToDatabase } from '../lib/db/mongodb';
import { accelerationToAngle } from '../lib/algorithms/angleConverter';
import { RawSensorDataCollection } from '../lib/models/RawSensorData';
import { AngleDataCollection, createAngleData } from '../lib/models/AngleData';

// 배치 처리 설정
const DEFAULT_BATCH_SIZE = 100;

/**
 * 배치 처리 결과 인터페이스
 */
interface ProcessingResult {
  success: boolean;
  processedCount: number;
  errorCount: number;
  lastProcessedNumber: number;
}

/**
 * 처리 상태 인터페이스
 */
interface ProcessingStatus {
  lastRawDataNumber: number;
  lastAngleDataNumber: number;
  unprocessedCount: number;
  totalRawData: number;
  totalAngleData: number;
}

/**
 * 원시 데이터 → 각도 데이터 변환 배치 처리
 */
export async function runBatchProcessing(batchSize: number = DEFAULT_BATCH_SIZE): Promise<ProcessingResult> {
  try {
    console.log(`시작: 배치 처리 (배치 크기: ${batchSize})`);
    
    // 데이터베이스 연결
    const { db } = await connectToDatabase();
    
    // 1. 마지막으로 처리된 AngleData의 number 조회
    const lastProcessedResult = await db.collection(AngleDataCollection)
      .find({})
      .sort({ number: -1 })
      .limit(1)
      .toArray();
    
    const lastProcessedNumber = lastProcessedResult.length > 0 ? lastProcessedResult[0].number : 0;
    console.log(`마지막으로 처리된 데이터 번호: ${lastProcessedNumber}`);
    
    // 2. 아직 처리되지 않은 RawSensorData 조회
    const rawDataCursor = db.collection(RawSensorDataCollection)
      .find({ number: { $gt: lastProcessedNumber } })
      .sort({ number: 1 })
      .limit(batchSize);
    
    const rawData = await rawDataCursor.toArray();
    
    if (rawData.length === 0) {
      console.log('처리할 새로운 데이터가 없습니다.');
      return {
        success: true,
        processedCount: 0,
        errorCount: 0,
        lastProcessedNumber
      };
    }
    
    console.log(`처리할 데이터 ${rawData.length}개 조회 완료`);
    
    // 3. 각 원시 데이터를 각도 데이터로 변환
    const angleDataBatch = [];
    let errorCount = 0;
    let maxProcessedNumber = lastProcessedNumber;
    
    for (const item of rawData) {
      try {
        // 가속도 → 각도 변환
        const angles = accelerationToAngle(item.accel.x, item.accel.y, item.accel.z);
        
        // 각도 데이터 객체 생성
        const angleData = createAngleData(
          item.number,
          angles.X,
          angles.Y,
          angles.Z,
          angles.X, // 필터링된 X 값 (단순화를 위해 동일 값 사용)
          angles.Y, // 필터링된 Y 값 (단순화를 위해 동일 값 사용)
          angles.Z, // 필터링된 Z 값 (단순화를 위해 동일 값 사용)
          calculateScore(angles), // 자세 점수 계산
          item.timestamp
        );
        
        angleDataBatch.push(angleData);
        maxProcessedNumber = Math.max(maxProcessedNumber, item.number);
        
      } catch (error) {
        console.error(`오류: 데이터 #${item.number} 처리 실패:`, error);
        errorCount++;
      }
    }
    
    // 4. 변환된 각도 데이터 저장
    if (angleDataBatch.length > 0) {
      await db.collection(AngleDataCollection).insertMany(angleDataBatch);
      console.log(`${angleDataBatch.length}개의 각도 데이터 저장 완료`);
    }
    
    return {
      success: true,
      processedCount: angleDataBatch.length,
      errorCount,
      lastProcessedNumber: maxProcessedNumber
    };
    
  } catch (error) {
    console.error('배치 처리 중 오류 발생:', error);
    return {
      success: false,
      processedCount: 0,
      errorCount: 1,
      lastProcessedNumber: 0
    };
  }
}

/**
 * 현재 처리 상태 조회
 */
export async function getProcessingStatus(): Promise<ProcessingStatus> {
  try {
    // 데이터베이스 연결
    const { db } = await connectToDatabase();
    
    // 마지막 원시 데이터 번호 조회
    const lastRawDataResult = await db.collection(RawSensorDataCollection)
      .find({})
      .sort({ number: -1 })
      .limit(1)
      .toArray();
    
    const lastRawDataNumber = lastRawDataResult.length > 0 ? lastRawDataResult[0].number : 0;
    
    // 마지막 각도 데이터 번호 조회
    const lastAngleDataResult = await db.collection(AngleDataCollection)
      .find({})
      .sort({ number: -1 })
      .limit(1)
      .toArray();
    
    const lastAngleDataNumber = lastAngleDataResult.length > 0 ? lastAngleDataResult[0].number : 0;
    
    // 전체 데이터 수 조회
    const totalRawData = await db.collection(RawSensorDataCollection).countDocuments({});
    const totalAngleData = await db.collection(AngleDataCollection).countDocuments({});
    
    // 미처리 데이터 수 계산
    const unprocessedCount = await db.collection(RawSensorDataCollection).countDocuments({
      number: { $gt: lastAngleDataNumber }
    });
    
    return {
      lastRawDataNumber,
      lastAngleDataNumber,
      unprocessedCount,
      totalRawData,
      totalAngleData
    };
    
  } catch (error) {
    console.error('처리 상태 조회 중 오류 발생:', error);
    return {
      lastRawDataNumber: 0,
      lastAngleDataNumber: 0,
      unprocessedCount: 0,
      totalRawData: 0,
      totalAngleData: 0
    };
  }
}

// 간단한 점수 계산 함수
function calculateScore(angles: { X: number, Y: number, Z: number }): number {
  // 각 축별 점수 계산 (0-100 범위)
  const xScore = Math.max(0, 100 - Math.pow(Math.abs(angles.X) / 45, 1.5) * 100);
  const yScore = Math.max(0, 100 - Math.pow(Math.abs(angles.Y) / 30, 1.5) * 100);
  const zScore = Math.max(0, 100 - Math.pow(Math.abs(angles.Z) / 30, 1.5) * 100);
  
  // 가중 평균으로 종합 점수 계산
  return Math.round(xScore * 0.4 + yScore * 0.4 + zScore * 0.2);
}

// 스크립트로 직접 실행된 경우
if (require.main === module) {
  runBatchProcessing()
    .then(result => {
      console.log('처리 결과:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('예상치 못한 오류:', error);
      process.exit(1);
    });
}
