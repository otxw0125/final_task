import type { NextApiRequest, NextApiResponse } from 'next';
import { getRawSensorDataCollection, getAngleDataCollection, getPostureScoreCollection } from '../../../lib/db/collections';
import { accelerationToAngle } from '../../../lib/algorithms/angleConverter';
import { analyzePostureFromAngles, createPostureScoreFromAnalysis } from '../../../lib/algorithms/postureAnalyzer';
import { createAngleData } from '../../../lib/models/AngleData';
import { RawSensorData } from '../../../lib/models/RawSensorData';

interface ProcessDataResponse {
  success: boolean;
  message: string;
  processedCount?: number;
  totalToProcess?: number;
  stage?: 'first' | 'second' | 'completed';
  timestamp: string;
}

// 2축 시스템용 점수 계산 함수 (X=좌우, Y=상하)
function calculateSimpleScore(angles: { X: number, Y: number }): number {
  // X축 (좌우): 정상 범위 ±15도, 목과 어깨에 부담
  const xScore = Math.max(0, 100 - Math.pow(Math.abs(angles.X) / 15, 1.5) * 100);
  
  // Y축 (상하): 정상 범위 ±20도, 허리에 부담이 가므로 더 중요하게 반영
  const yScore = Math.max(0, 100 - Math.pow(Math.abs(angles.Y) / 20, 1.5) * 100);
  
  // 가중 평균으로 종합 점수 계산 (상하가 더 중요)
  return Math.round(xScore * 0.3 + yScore * 0.7);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessDataResponse>
) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'POST 메서드만 허용됩니다.',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const { stage } = req.body; // 'start', 'first', 'second'

    const rawSensorCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();
    const postureScoreCollection = await getPostureScoreCollection();

    if (stage === 'start') {
      // 처리 시작 - 처리할 데이터 개수 반환
      const totalCount = await rawSensorCollection.countDocuments({ processedToAngle: false });
      
      if (totalCount === 0) {
        return res.status(200).json({
          success: true,
          message: '처리할 데이터가 없습니다.',
          processedCount: 0,
          totalToProcess: 0,
          stage: 'completed',
          timestamp: new Date().toISOString()
        });
      }

      // 2초 후 첫 번째 절반 처리 (15초 -> 2초로 단축)
      setTimeout(async () => {
        await processHalfData('first');
      }, 2000);

      return res.status(200).json({
        success: true,
        message: `처리를 시작했습니다. 총 ${totalCount}개의 데이터가 있습니다. 2초 후에 첫 번째 절반이 처리됩니다.`,
        totalToProcess: totalCount,
        timestamp: new Date().toISOString()
      });
    }

    // 수동으로 특정 단계를 호출할 때 사용
    if (stage === 'first' || stage === 'second') {
      const result = await processHalfData(stage);
      return res.status(200).json(result);
    }

    // 모든 데이터를 한 번에 처리
    if (stage === 'all') {
      const result = await processAllData();
      return res.status(200).json(result);
    }

    return res.status(400).json({
      success: false,
      message: 'stage 파라미터는 "start", "first", "second", 또는 "all" 중 하나여야 합니다.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('데이터 처리 중 오류 발생:', error);
    return res.status(500).json({
      success: false,
      message: '데이터 처리 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }

  async function processHalfData(stage: 'first' | 'second'): Promise<ProcessDataResponse> {
    try {
      const rawSensorCollection = await getRawSensorDataCollection();
      const angleDataCollection = await getAngleDataCollection();
      const postureScoreCollection = await getPostureScoreCollection();

      // 처리되지 않은 데이터 가져오기
      const unprocessedData = await rawSensorCollection
        .find({ processedToAngle: false })
        .sort({ timestamp: 1 })
        .toArray();

      if (unprocessedData.length === 0) {
        return {
          success: true,
          message: '처리할 데이터가 없습니다.',
          processedCount: 0,
          stage: 'completed',
          timestamp: new Date().toISOString()
        };
      }

      const totalCount = unprocessedData.length;
      const halfCount = Math.ceil(totalCount / 2);
      
      let dataToProcess: RawSensorData[];
      
      if (stage === 'first') {
        dataToProcess = unprocessedData.slice(0, halfCount);
      } else {
        dataToProcess = unprocessedData.slice(halfCount);
      }

      let processedCount = 0;

      // 데이터 처리
      for (const rawData of dataToProcess) {
        try {
          // 각도 변환 (2축만 사용)
          const angleResult = accelerationToAngle(
            rawData.sensor_values.x_accel,
            rawData.sensor_values.y_accel,
            rawData.sensor_values.z_accel
          );

          // AngleData 생성 및 저장 (2축만 사용: X=좌우, Y=상하)
          const angleData = createAngleData(
            rawData.number || 0,
            angleResult.X,    // X축: 좌우 기울기
            angleResult.Y,    // Y축: 상하 기울기
            angleResult.X,    // 필터링된 좌우 기울기 (동일한 값 사용)
            angleResult.Y,    // 필터링된 상하 기울기 (동일한 값 사용)
            calculateSimpleScore(angleResult), // 2축 기반 점수 계산
            rawData.timestamp instanceof Date ? rawData.timestamp : new Date(rawData.timestamp)
          );

          angleData.userId = rawData.userId;

          const angleInsertResult = await angleDataCollection.insertOne(angleData);

          // 자세 분석 및 PostureScore 생성 (2축만 사용)
          const postureAnalysis = analyzePostureFromAngles(angleResult);
          const postureScore = createPostureScoreFromAnalysis(
            postureAnalysis,
            rawData.number || 0,
            rawData.timestamp instanceof Date ? rawData.timestamp : new Date(rawData.timestamp)
          );

          await postureScoreCollection.insertOne(postureScore);

          // rawsensordata의 processedToAngle을 true로 업데이트
          await rawSensorCollection.updateOne(
            { _id: rawData._id },
            { $set: { processedToAngle: true } }
          );

          processedCount++;
        } catch (error) {
          console.error(`데이터 처리 실패 (ID: ${rawData._id}):`, error);
        }
      }

      // 첫 번째 단계 완료 후 두 번째 절반 처리 예약 (시간 단축)
      if (stage === 'first') {
        setTimeout(async () => {
          await processHalfData('second');
        }, 2000); // 15초 -> 2초로 단축
      }

      return {
        success: true,
        message: `${stage === 'first' ? '첫 번째' : '두 번째'} 절반 처리가 완료되었습니다. ${processedCount}개 데이터를 처리했습니다.${stage === 'first' ? ' 2초 후에 두 번째 절반이 처리됩니다.' : ''}`,
        processedCount,
        stage: stage === 'second' ? 'completed' : stage,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`${stage} 단계 처리 중 오류:`, error);
      return {
        success: false,
        message: `${stage} 단계 처리 중 오류가 발생했습니다.`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async function processAllData(): Promise<ProcessDataResponse> {
    try {
      const rawSensorCollection = await getRawSensorDataCollection();
      const angleDataCollection = await getAngleDataCollection();
      const postureScoreCollection = await getPostureScoreCollection();

      // 처리되지 않은 데이터 가져오기
      const unprocessedData = await rawSensorCollection
        .find({ processedToAngle: false })
        .sort({ timestamp: 1 })
        .toArray();

      if (unprocessedData.length === 0) {
        return {
          success: true,
          message: '처리할 데이터가 없습니다.',
          processedCount: 0,
          totalToProcess: 0,
          stage: 'completed',
          timestamp: new Date().toISOString()
        };
      }

      const totalCount = unprocessedData.length;

      let processedCount = 0;

      // 데이터 처리
      for (const rawData of unprocessedData) {
        try {
          // 각도 변환 (2축만 사용)
          const angleResult = accelerationToAngle(
            rawData.sensor_values.x_accel,
            rawData.sensor_values.y_accel,
            rawData.sensor_values.z_accel
          );

          // AngleData 생성 및 저장 (2축만 사용: X=좌우, Y=상하)
          const angleData = createAngleData(
            rawData.number || 0,
            angleResult.X,    // X축: 좌우 기울기
            angleResult.Y,    // Y축: 상하 기울기
            angleResult.X,    // 필터링된 좌우 기울기 (동일한 값 사용)
            angleResult.Y,    // 필터링된 상하 기울기 (동일한 값 사용)
            calculateSimpleScore(angleResult), // 2축 기반 점수 계산
            rawData.timestamp instanceof Date ? rawData.timestamp : new Date(rawData.timestamp)
          );

          angleData.userId = rawData.userId;

          const angleInsertResult = await angleDataCollection.insertOne(angleData);

          // 자세 분석 및 PostureScore 생성 (2축만 사용)
          const postureAnalysis = analyzePostureFromAngles(angleResult);
          const postureScore = createPostureScoreFromAnalysis(
            postureAnalysis,
            rawData.number || 0,
            rawData.timestamp instanceof Date ? rawData.timestamp : new Date(rawData.timestamp)
          );

          await postureScoreCollection.insertOne(postureScore);

          // rawsensordata의 processedToAngle을 true로 업데이트
          await rawSensorCollection.updateOne(
            { _id: rawData._id },
            { $set: { processedToAngle: true } }
          );

          processedCount++;
        } catch (error) {
          console.error(`데이터 처리 실패 (ID: ${rawData._id}):`, error);
        }
      }

      return {
        success: true,
        message: `모든 데이터를 처리했습니다. ${processedCount}개 데이터를 처리했습니다.`,
        processedCount,
        totalToProcess: totalCount,
        stage: 'completed',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('모든 데이터 처리 중 오류 발생:', error);
      return {
        success: false,
        message: '모든 데이터 처리 중 오류가 발생했습니다.',
        timestamp: new Date().toISOString()
      };
    }
  }
} 