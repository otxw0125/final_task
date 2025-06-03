import { NextRequest, NextResponse } from 'next/server';
import { getRawSensorDataCollection, getAngleDataCollection } from '../../../../lib/db/collections';

export async function POST(request: NextRequest) {
  try {
    const rawSensorCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();

    // RawSensorData에서 number가 7자리 미만인 데이터 삭제
    const deleteRawResult = await rawSensorCollection.deleteMany({
      $or: [
        { number: { $lt: 1000000 } }, // 7자리 미만 (1,000,000 미만)
        { number: { $exists: false } }, // number 필드가 없는 경우
        { number: null as any } // number가 null인 경우
      ]
    });

    // AngleData의 모든 데이터 삭제
    const deleteAngleResult = await angleDataCollection.deleteMany({});

    console.log(`Deleted ${deleteRawResult.deletedCount} raw sensor data records`);
    console.log(`Deleted ${deleteAngleResult.deletedCount} angle data records`);

    return NextResponse.json({
      success: true,
      message: '데이터 삭제가 완료되었습니다.',
      deletedRawSensorData: deleteRawResult.deletedCount,
      deletedAngleData: deleteAngleResult.deletedCount
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/data-management/delete] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false,
      message: '데이터 삭제 중 오류가 발생했습니다.', 
      error: errorMessage 
    }, { status: 500 });
  }
} 