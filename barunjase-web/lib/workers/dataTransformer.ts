import { getRawSensorDataCollection, getAngleDataCollection } from '../db/collections';
import { RawSensorData } from '../models/RawSensorData';
import { AngleData, createAngleData } from '../models/AngleData';
import { accelerationToAngle, calculatePostureStability, isAngleWithinNormalRange } from '../algorithms/angleConverter';

/**
 * 데이터 변환 워커
 * 
 * 이 모듈은 원시 센서 데이터를 처리하여 각도 데이터로 변환하는 작업을 수행합니다.
 * 배치 처리 방식으로 동작하며, 일정 주기마다 또는 수동으로 호출하여 실행할 수 있습니다.
 */

interface TransformationResult {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  details: string[];
}

/**
 * 원시 데이터를 각도 데이터로 변환
 * 
 * @param limit 처리할 최대 레코드 수 (기본값: 100)
 * @returns 변환 결과 정보
 */
export async function transformRawDataToAngleData(limit: number = 100): Promise<TransformationResult> {
  const result: TransformationResult = {
    processed: 0,
    created: 0,
    updated: 0,
    failed: 0,
    details: []
  };

  try {
    // 데이터베이스 컬렉션 접근
    const rawDataCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();
    
    // 처리할 원시 데이터 쿼리
    // 1. 아직 처리되지 않은 최신 데이터부터 가져옴
    const latestProcessed = await angleDataCollection
      .find({})
      .sort({ sensorDataNumber: -1 })
      .limit(1)
      .toArray();
    
    let query = {};
    if (latestProcessed && latestProcessed.length > 0) {
      // 마지막으로 처리된 번호보다 큰 데이터 조회
      query = { number: { $gt: latestProcessed[0].sensorDataNumber } };
    }
    
    // 원시 데이터 조회
    const rawDataArray = await rawDataCollection
      .find(query)
      .sort({ number: 1 }) // 오래된 데이터부터 처리
      .limit(limit)
      .toArray();
    
    // 이전 변환 데이터 (안정성 계산을 위해)
    let previousAngleData: AngleData | null = null;
    if (latestProcessed && latestProcessed.length > 0) {
      previousAngleData = latestProcessed[0];
    }
    
    // 데이터 처리
    const angleDataToInsert: AngleData[] = [];
    
    // 각 센서 데이터 처리
    for (const rawData of rawDataArray) {
      try {
        result.processed++;
        
        // 가속도 데이터를 각도로 변환
        const currentAngles = accelerationToAngle(rawData.accel.x, rawData.accel.y, rawData.accel.z);
        
        // 자세 점수 계산
        const score = calculatePostureScore(currentAngles);
        
        // 각도 데이터 생성
        const currentAngleData = createAngleData(
          rawData.number,
          currentAngles.X,
          currentAngles.Y,
          currentAngles.Z,
          currentAngles.X, // 필터링 값 (현재는 동일)
          currentAngles.Y,
          currentAngles.Z,
          score,
          rawData.timestamp
        );
        
        // 자세 안정성 업데이트
        if (previousAngleData) {
          const previousAngles = {
            X: previousAngleData.angles.x,
            Y: previousAngleData.angles.y,
            Z: previousAngleData.angles.z
          };
          const stability = calculatePostureStability(previousAngles, currentAngles);
          
          // 연속 자세 시간 계산
          if (isSimilarPosture(previousAngleData, currentAngleData)) {
            currentAngleData.scoreData.continuousDuration = 
              previousAngleData.scoreData.continuousDuration + 
              (currentAngleData.timestamp.getTime() - previousAngleData.timestamp.getTime()) / 1000;
          }
        }
        
        // 처리할 데이터 배열에 추가
        angleDataToInsert.push(currentAngleData);
        
        // 이전 데이터 업데이트
        previousAngleData = currentAngleData;
        
      } catch (error) {
        console.error(`Failed to process raw data #${rawData.number}:`, error);
        result.failed++;
        result.details.push(`Error processing #${rawData.number}: ${(error as Error).message}`);
      }
    }
    
    // 배치로 데이터 저장 (하나씩 처리)
    for (const angleData of angleDataToInsert) {
      try {
        await angleDataCollection.insertOne(angleData);
        result.created++;
      } catch (error: any) {
        // 중복 키 오류 처리 (E11000)
        if (error.code === 11000) {
          // 중복된 경우 업데이트
          await angleDataCollection.replaceOne(
            { sensorDataNumber: angleData.sensorDataNumber },
            angleData
          );
          result.updated++;
        } else {
          throw error; // 기타 오류는 상위로 전파
        }
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Data transformation worker error:', error);
    result.failed++;
    result.details.push(`Worker error: ${(error as Error).message}`);
    return result;
  }
}

/**
 * 자세 점수 계산
 * 
 * 입력된 각도 데이터를 기반으로 0-100 사이의 자세 점수를 계산합니다.
 * 0은 매우 나쁜 자세, 100은 완벽한 자세를 의미합니다.
 * 
 * @param angles 각도 데이터
 * @returns 계산된 자세 점수 (0-100)
 */
function calculatePostureScore(angles: { X: number; Y: number; Z: number }): number {
  // 정상 범위 정의
  const idealRanges = {
    X: { min: -10, max: 10, weight: 0.4 },  // 목 기울기 (피치)
    Y: { min: -10, max: 10, weight: 0.4 },  // 허리 기울기 (롤)
    Z: { min: -5, max: 5, weight: 0.2 }     // 몸 회전 (요)
  };
  
  // 각 축별 벗어난 정도 계산
  const deviations = {
    X: calculateDeviation(angles.X, idealRanges.X.min, idealRanges.X.max),
    Y: calculateDeviation(angles.Y, idealRanges.Y.min, idealRanges.Y.max),
    Z: calculateDeviation(angles.Z, idealRanges.Z.min, idealRanges.Z.max)
  };
  
  // 가중 평균 계산
  const weightedScore = 
    (1 - deviations.X) * idealRanges.X.weight +
    (1 - deviations.Y) * idealRanges.Y.weight +
    (1 - deviations.Z) * idealRanges.Z.weight;
  
  // 0-100 범위로 변환
  const finalScore = Math.round(weightedScore * 100);
  
  // 범위 제한
  return Math.max(0, Math.min(100, finalScore));
}

/**
 * 정상 범위에서 벗어난 정도 계산 (0-1)
 */
function calculateDeviation(value: number, min: number, max: number): number {
  if (value >= min && value <= max) {
    return 0; // 범위 내
  }
  
  // 벗어난 경우, 얼마나 심각한지 계산
  const deviation = value < min ? min - value : value - max;
  
  // 정규화 (최대 50도 벗어나면 1.0으로 간주)
  const maxDeviation = 50;
  return Math.min(deviation / maxDeviation, 1);
}

/**
 * 두 자세 데이터가 유사한지 확인
 */
function isSimilarPosture(prev: AngleData, current: AngleData): boolean {
  // 카테고리가 다르면 다른 자세로 간주
  if (prev.scoreData.category !== current.scoreData.category) {
    return false;
  }
  
  // 각도 차이가 일정 임계값 이내인지 확인
  const threshold = 15; // 각도 차이 임계값 (도)
  
  return (
    Math.abs(prev.angles.x - current.angles.x) <= threshold &&
    Math.abs(prev.angles.y - current.angles.y) <= threshold &&
    Math.abs(prev.angles.z - current.angles.z) <= threshold
  );
}

/**
 * 데이터 변환 정기 작업 시작
 * 
 * @param intervalMinutes 작업 간격 (분)
 * @param batchSize 배치당 처리 레코드 수
 * @returns 인터벌 ID (정지시 필요)
 */
export function startPeriodicTransformation(intervalMinutes: number = 1, batchSize: number = 100): NodeJS.Timeout {
  console.log(`Starting periodic data transformation (every ${intervalMinutes} minutes, batch size: ${batchSize})`);
  
  // 즉시 한 번 실행
  transformRawDataToAngleData(batchSize)
    .then(result => {
      console.log(`Initial data transformation completed: processed=${result.processed}, created=${result.created}, updated=${result.updated}, failed=${result.failed}`);
    })
    .catch(error => {
      console.error('Initial data transformation failed:', error);
    });
  
  // 주기적 실행 설정
  return setInterval(() => {
    transformRawDataToAngleData(batchSize)
      .then(result => {
        if (result.processed > 0) {
          console.log(`Periodic data transformation: processed=${result.processed}, created=${result.created}, updated=${result.updated}, failed=${result.failed}`);
        }
      })
      .catch(error => {
        console.error('Periodic data transformation failed:', error);
      });
  }, intervalMinutes * 60 * 1000);
}

/**
 * 변환 작업 정지
 * 
 * @param intervalId startPeriodicTransformation의 반환값
 */
export function stopPeriodicTransformation(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('Periodic data transformation stopped');
} 