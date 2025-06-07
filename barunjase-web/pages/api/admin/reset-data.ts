import type { NextApiRequest, NextApiResponse } from 'next';
import { getRawSensorDataCollection, getAngleDataCollection } from '../../../lib/db/collections';

interface ResetDataResponse {
  success: boolean;
  message: string;
  deletedAngleCount?: number;
  updatedRawDataCount?: number;
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResetDataResponse>
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
    // 컬렉션 가져오기
    const rawSensorCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();

    // angledata 컬렉션의 모든 데이터 삭제
    const deleteResult = await angleDataCollection.deleteMany({});
    
    // rawsensordata의 모든 문서의 processedToAngle을 false로 업데이트
    const updateResult = await rawSensorCollection.updateMany(
      {},
      { $set: { processedToAngle: false } }
    );

    console.log(`[${new Date().toISOString()}] 데이터 리셋 완료: angledata ${deleteResult.deletedCount}개 삭제, rawsensordata ${updateResult.modifiedCount}개 업데이트`);

    return res.status(200).json({
      success: true,
      message: '데이터 리셋이 완료되었습니다.',
      deletedAngleCount: deleteResult.deletedCount,
      updatedRawDataCount: updateResult.modifiedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('데이터 리셋 중 오류 발생:', error);
    return res.status(500).json({
      success: false,
      message: '데이터 리셋 중 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    });
  }
} 