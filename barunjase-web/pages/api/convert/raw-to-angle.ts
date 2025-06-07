import type { NextApiRequest, NextApiResponse } from 'next';
import { getRawSensorDataCollection, getAngleDataCollection } from '../../../lib/db/collections';
import { accelerationToAngle } from '../../../lib/algorithms/angleConverter';
import { createAngleData } from '../../../lib/models/AngleData';
import { ObjectId } from 'mongodb';

interface ConvertResponse {
  success: boolean;
  message: string;
  angleData?: any;
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConvertResponse>
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
    const { sensorDataId } = req.body;

    if (!sensorDataId) {
      return res.status(400).json({
        success: false,
        message: 'sensorDataId가 필요합니다.',
        timestamp: new Date().toISOString()
      });
    }

    const rawSensorCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();

    // raw 센서 데이터 조회
    const rawData = await rawSensorCollection.findOne({ _id: new ObjectId(sensorDataId) });
    
    if (!rawData) {
      return res.status(404).json({
        success: false,
        message: '해당 센서 데이터를 찾을 수 없습니다.',
        timestamp: new Date().toISOString()
      });
    }

    // 각도 변환 (2축만 사용)
    const angleResult = accelerationToAngle(
      rawData.sensor_values.x_accel,
      rawData.sensor_values.y_accel,
      rawData.sensor_values.z_accel
    );

    // AngleData 생성 (2축만 사용)
    const angleData = createAngleData(
      rawData.number || 0,
      angleResult.X,   // 좌우 기울기
      angleResult.Y,   // 앞뒤 기울기
      angleResult.X,   // 필터링된 좌우 기울기
      angleResult.Y,   // 필터링된 앞뒤 기울기
      75,              // 기본 점수
      rawData.timestamp instanceof Date ? rawData.timestamp : new Date(rawData.timestamp)
    );

    // userId 설정
    angleData.userId = rawData.userId;

    // DB에 저장
    const insertResult = await angleDataCollection.insertOne(angleData);

    // rawsensordata의 processedToAngle을 true로 업데이트
    await rawSensorCollection.updateOne(
      { _id: rawData._id },
      { $set: { processedToAngle: true } }
    );

    return res.status(200).json({
      success: true,
      message: '데이터 변환이 완료되었습니다.',
      angleData: {
        _id: insertResult.insertedId,
        angles: angleData.angles,
        timestamp: angleData.timestamp
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('데이터 변환 중 오류 발생:', error);
    return res.status(500).json({
      success: false,
      message: '데이터 변환 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
} 