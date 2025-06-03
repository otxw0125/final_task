import { NextRequest, NextResponse } from 'next/server';
import { getAngleDataCollection } from '../../../../lib/db/collections';

export async function POST(request: NextRequest) {
  try {
    const angleDataCollection = await getAngleDataCollection();

    // 초기값으로 설정된 AngleData 삭제 (처음 몇 개의 데이터 또는 특정 조건)
    // 1. 가장 오래된 5개 데이터 삭제 (초기 안정화 구간)
    // 2. 또는 특정 시간 범위의 데이터 삭제 (예: 처음 30초)
    
    let body = {};
    try {
      body = await request.json();
    } catch {
      // body가 없는 경우 기본값 사용
      body = {};
    }

    const { 
      excludeCount = 5, // 제외할 초기 데이터 개수 (기본값 5개)
      excludeTimeSeconds = 30, // 제외할 시간 범위 (초, 기본값 30초)
      useTimeRange = false // 시간 범위 사용 여부
    } = body as any;

    let deleteResult;

    if (useTimeRange) {
      // 시간 범위 기반 삭제
      const oldestAngleData = await angleDataCollection.findOne(
        {},
        { sort: { timestamp: 1 } }
      );

      if (oldestAngleData) {
        const cutoffTime = new Date(oldestAngleData.timestamp);
        cutoffTime.setSeconds(cutoffTime.getSeconds() + excludeTimeSeconds);

        deleteResult = await angleDataCollection.deleteMany({
          timestamp: { $lte: cutoffTime }
        });
      } else {
        deleteResult = { deletedCount: 0 };
      }
    } else {
      // 개수 기반 삭제 (가장 오래된 N개)
      const oldestAngleDataList = await angleDataCollection.find(
        {},
        { 
          sort: { timestamp: 1 },
          limit: excludeCount,
          projection: { _id: 1 }
        }
      ).toArray();

      if (oldestAngleDataList.length > 0) {
        const idsToDelete = oldestAngleDataList.map(data => data._id);
        deleteResult = await angleDataCollection.deleteMany({
          _id: { $in: idsToDelete }
        });
      } else {
        deleteResult = { deletedCount: 0 };
      }
    }

    console.log(`Deleted ${deleteResult.deletedCount} initial angle data records`);

    return NextResponse.json({
      success: true,
      message: `초기값으로 설정된 ${deleteResult.deletedCount}개의 AngleData가 제외되었습니다.`,
      deletedCount: deleteResult.deletedCount,
      excludeMethod: useTimeRange ? `시간 범위 (${excludeTimeSeconds}초)` : `개수 기반 (${excludeCount}개)`
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/data-management/reset-filter-initial] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false,
      message: '초기값 AngleData 제외 중 오류가 발생했습니다.', 
      error: errorMessage 
    }, { status: 500 });
  }
} 