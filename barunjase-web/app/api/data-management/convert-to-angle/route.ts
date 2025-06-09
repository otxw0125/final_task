import { NextRequest, NextResponse } from 'next/server';
import { getRawSensorDataCollection, getAngleDataCollection } from '../../../../lib/db/collections';
import { convertAccelToAngles } from '../../../../lib/utils/conversion';
import { createAngleData } from '../../../../lib/models/AngleData';

export async function POST(request: NextRequest) {
  try {
    const rawSensorCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();

    // processedToAngle이 false이거나 존재하지 않는 RawSensorData 조회
    const unprocessedRawData = await rawSensorCollection.find({
      $or: [
        { processedToAngle: false },
        { processedToAngle: { $exists: false } }
      ]
    }).toArray();

    if (unprocessedRawData.length === 0) {
      return NextResponse.json({
        success: true,
        message: '변환할 데이터가 없습니다.',
        processed: 0,
        skipped: 0,
        errors: []
      }, { status: 200 });
    }

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rawData of unprocessedRawData) {
      try {
        if (!rawData.number || !rawData.sensor_values) {
          skipped++;
          errors.push(`ID ${rawData._id}: number 또는 sensor_values가 없습니다.`);
          continue;
        }

        // 가속도 데이터를 각도로 변환
        const angleValues = convertAccelToAngles(rawData.sensor_values);
        
        // AngleData 생성
        const angleData = createAngleData(
          rawData.number,
          angleValues.x,
          angleValues.y,
          angleValues.x, // xFiltered (동일한 값 사용)
          angleValues.y, // yFiltered (동일한 값 사용)
          75, // score 기본값
          new Date(rawData.timestamp)
        );

        // 기존 AngleData가 있는지 확인
        const existingAngleData = await angleDataCollection.findOne({ 
          sensorDataNumber: rawData.number 
        });

        if (existingAngleData) {
          // 업데이트
          await angleDataCollection.replaceOne(
            { sensorDataNumber: rawData.number },
            angleData
          );
        } else {
          // 새로 삽입
          await angleDataCollection.insertOne(angleData);
        }

        // processedToAngle 플래그 업데이트
        await rawSensorCollection.updateOne(
          { _id: rawData._id },
          { 
            $set: { 
              processedToAngle: true,
              updatedAt: new Date()
            } 
          }
        );

        processed++;

      } catch (error) {
        skipped++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`ID ${rawData._id}: ${errorMessage}`);
        console.error(`Error processing raw data ${rawData._id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${processed}개의 데이터가 변환되었습니다.`,
      processed,
      skipped,
      errors
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/data-management/convert-to-angle] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false,
      message: 'rawsensordata를 angledata로 변환하는 중 오류가 발생했습니다.', 
      error: errorMessage 
    }, { status: 500 });
  }
} 