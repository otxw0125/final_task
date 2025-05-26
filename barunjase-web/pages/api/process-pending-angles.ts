import type { NextApiRequest, NextApiResponse } from 'next';
import { getRawSensorDataCollection, getAngleDataCollection, getPostureScoreCollection } from '../../lib/db/collections';
import { RawSensorData } from '../../lib/models/RawSensorData';
import { AngleData, createAngleData } from '../../lib/models/AngleData';
import { PostureScore } from '../../lib/models/PostureScore';
import { accelerationToAngle, AngleResult } from '../../lib/algorithms/angleConverter';
import { analyzePostureFromAngles, createPostureScoreFromAnalysis } from '../../lib/algorithms/postureAnalyzer';
import { ObjectId } from 'mongodb';

interface ProcessSummary {
  totalChecked: number;
  successfullyProcessedRawData: number; // AngleData 및 PostureScore까지 모두 성공
  angleDataCreated: number;
  postureScoresCreated: number;
  flagUpdateOnlyForExistingAngleOrScore: number;
  errors: Array<{ rawDataId?: string; rawDataNumber?: number; stage: string; error: string }>;
}

interface ApiResponse {
  success: boolean;
  message: string;
  summary?: ProcessSummary;
  details?: any;
}

const FLAG_FIELD_NAME = 'processedToAngle'; // 또는 'fullyProcessed' 등

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  console.log(`[${new Date().toISOString()}] Received request to /api/process-pending-angles`);

  try {
    const rawSensorCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();
    const postureScoreCollection = await getPostureScoreCollection();

    const pendingRawDataList = await rawSensorCollection.find({
      $or: [
        { [FLAG_FIELD_NAME]: false },
        { [FLAG_FIELD_NAME]: { $exists: false } }
      ]
    }).limit(100).toArray(); 

    if (pendingRawDataList.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No pending raw sensor data to process.',
        summary: { totalChecked: 0, successfullyProcessedRawData: 0, angleDataCreated: 0, postureScoresCreated: 0, flagUpdateOnlyForExistingAngleOrScore: 0, errors: [] }
      });
    }

    const summary: ProcessSummary = {
      totalChecked: pendingRawDataList.length,
      successfullyProcessedRawData: 0,
      angleDataCreated: 0,
      postureScoresCreated: 0,
      flagUpdateOnlyForExistingAngleOrScore: 0,
      errors: [],
    };

    for (const rawData of pendingRawDataList) {
      if (!rawData._id || !rawData.number || rawData.sensor_values?.x_accel === undefined || rawData.sensor_values?.y_accel === undefined || rawData.sensor_values?.z_accel === undefined) {
        summary.errors.push({ 
          rawDataId: rawData._id?.toHexString(), 
          rawDataNumber: rawData.number, 
          stage: 'initial_check',
          error: 'Missing _id, number or essential sensor_values for processing.' 
        });
        continue;
      }

      let angleDoc: AngleData | null = null;
      let postureScoreDoc: PostureScore | null = null;
      let requiresRawFlagUpdate = false;

      try {
        // 1. 각도 변환
        const angles: AngleResult = accelerationToAngle(
          rawData.sensor_values.x_accel,
          rawData.sensor_values.y_accel,
          rawData.sensor_values.z_accel
        );

        // 2. AngleData 생성 및 저장 시도
        try {
          angleDoc = createAngleData(
            rawData.number,
            angles.X, angles.Y, angles.Z,
            angles.X, angles.Y, angles.Z, 75,
            rawData.timestamp instanceof Date ? rawData.timestamp : new Date(rawData.timestamp)
          );
          angleDoc.userId = rawData.userId;
          await angleDataCollection.insertOne(angleDoc as AngleData);
          summary.angleDataCreated++;
          requiresRawFlagUpdate = true;
        } catch (angleInsertError: any) {
          if (angleInsertError.code === 11000) { // 중복 키 에러
            console.warn(`AngleData for sensorDataNumber ${rawData.number} already exists.`);
            // 기존 AngleData를 가져와서 PostureScore 생성에 사용
            angleDoc = await angleDataCollection.findOne({ sensorDataNumber: rawData.number }) as AngleData;
            if (!angleDoc) {
                summary.errors.push({
                    rawDataId: rawData._id.toHexString(), rawDataNumber: rawData.number,
                    stage: 'angle_data_fetch_after_duplicate', 
                    error: 'AngleData duplicate, but failed to fetch existing.'
                });
                continue; // 다음 rawData로
            }
            summary.flagUpdateOnlyForExistingAngleOrScore++;
            requiresRawFlagUpdate = true; // 플래그 업데이트 필요
          } else {
            throw angleInsertError; // 다른 삽입 에러는 상위 catch로 전파
          }
        }
        
        // 3. PostureScore 생성 및 저장 시도 (angleDoc이 있어야 함)
        if (angleDoc) {
          try {
            const postureAnalysis = analyzePostureFromAngles({ X: angleDoc.angles.x, Y: angleDoc.angles.y, Z: angleDoc.angles.z });
            postureScoreDoc = createPostureScoreFromAnalysis(
              postureAnalysis, 
              rawData.number, 
              angleDoc.timestamp instanceof Date ? angleDoc.timestamp : new Date(angleDoc.timestamp)
            );
             // postureScoreDoc.userId = rawData.userId; // createPostureScore에는 userId가 없음. 필요시 모델/함수 수정.

            await postureScoreCollection.insertOne(postureScoreDoc as PostureScore);
            summary.postureScoresCreated++;
            // AngleData와 PostureScore 모두 성공 시 rawData 플래그 업데이트 대상
          } catch (scoreInsertError: any) {
            if (scoreInsertError.code === 11000) { // 중복 키 에러 (number unique)
              console.warn(`PostureScore for number ${rawData.number} already exists.`);
              // 이미 PostureScore가 있다면, 특별히 더 할 작업은 없음 (오류 아님)
              // requiresRawFlagUpdate는 angleData 생성/존재 시 이미 true일 것임.
            } else {
              throw scoreInsertError; // 다른 삽입 에러는 상위 catch로 전파
            }
          }
        }

        // 4. RawSensorData 플래그 업데이트
        if (requiresRawFlagUpdate) {
          const updateResult = await rawSensorCollection.updateOne(
            { _id: rawData._id },
            { $set: { [FLAG_FIELD_NAME]: true, updatedAt: new Date() } }
          );
          if (updateResult.modifiedCount > 0) {
            summary.successfullyProcessedRawData++;
          } else {
            console.warn(`RawSensorData flag for _id ${rawData._id} (number ${rawData.number}) was not modified, possibly already updated by another process.`);
            // 이미 true였다면 successfullyProcessedRawData에 포함하지 않거나, 별도 카운트
          }
        }

      } catch (processingError: any) {
        console.error(`Error processing rawDataId ${rawData._id} (number ${rawData.number}):`, processingError);
        summary.errors.push({ 
          rawDataId: rawData._id.toHexString(), 
          rawDataNumber: rawData.number, 
          stage: 'main_processing_loop',
          error: processingError.message 
        });
      }
    }

    console.log(`[${new Date().toISOString()}] Finished processing. Summary:`, summary);
    return res.status(200).json({
      success: true,
      message: `Batch processing completed. Checked: ${summary.totalChecked}, Fully Processed: ${summary.successfullyProcessedRawData}, AngleData Created: ${summary.angleDataCreated}, PostureScores Created: ${summary.postureScoresCreated}, Flag Update Only: ${summary.flagUpdateOnlyForExistingAngleOrScore}, Errors: ${summary.errors.length}.`,
      summary,
    });

  } catch (error: any) {
    console.error('Critical error in /api/process-pending-angles:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during batch processing.',
      details: error.message,
    });
  }
} 