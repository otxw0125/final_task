import { NextRequest, NextResponse } from 'next/server';
import { getRawSensorDataCollection } from '../../../../lib/db/collections';

export async function POST(request: NextRequest) {
  try {
    const rawSensorCollection = await getRawSensorDataCollection();

    // 남은 RawSensorData의 processedToAngle 플래그를 false로 리셋
    const updateResult = await rawSensorCollection.updateMany(
      {}, // 모든 문서 대상
      { 
        $set: { 
          processedToAngle: false,
          updatedAt: new Date()
        } 
      }
    );

    console.log(`Updated ${updateResult.modifiedCount} raw sensor data records`);

    return NextResponse.json({
      success: true,
      message: 'processedToAngle 플래그가 초기화되었습니다.',
      updatedCount: updateResult.modifiedCount
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/data-management/reset-flags] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false,
      message: 'processedToAngle 플래그 초기화 중 오류가 발생했습니다.', 
      error: errorMessage 
    }, { status: 500 });
  }
} 