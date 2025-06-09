import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from "@/lib/db/mongodb";
import { getAngleDataCollection, getRawSensorDataCollection } from "@/lib/db/collections";
import { RawSensorData, RawSensorDataCollection } from "@/lib/models/RawSensorData";
import { AngleData, AngleDataCollection, createAngleData } from "@/lib/models/AngleData";
import { convertAccelToAngles } from "@/lib/utils/conversion";
import { calculatePostureScore } from "../posture-score/route";
import { createPostureScore } from "@/lib/models/PostureScore";
import { ObjectId } from 'mongodb';

interface ProcessRequest {
  rawSensorDataNumber?: number; // 특정 RawSensorData number를 지정하여 처리
  rawSensorDataId?: string; // 또는 특정 RawSensorData _id를 지정
  processOldestUnprocessed?: boolean; // 처리되지 않은 가장 오래된 데이터 처리
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json();
    await connectToDatabase();
    const rawSensorCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();

    let rawData: RawSensorData | null = null;

    if (body.rawSensorDataId) {
      if (!ObjectId.isValid(body.rawSensorDataId)) {
        return NextResponse.json({ message: "Invalid rawSensorDataId format" }, { status: 400 });
      }
      rawData = await rawSensorCollection.findOne({ _id: new ObjectId(body.rawSensorDataId) });
    } else if (body.rawSensorDataNumber !== undefined) {
      rawData = await rawSensorCollection.findOne({ number: body.rawSensorDataNumber });
    } else if (body.processOldestUnprocessed) {
      console.log('[DEBUG] Finding oldest unprocessed data...');
      const query = { $or: [{ processedToAngle: false }, { processedToAngle: { $exists: false } }] };
      console.log('[DEBUG] Query:', JSON.stringify(query));
      rawData = await rawSensorCollection.findOne(
        query,
        { sort: { timestamp: 1 } } // 가장 오래된 것부터
      );
      console.log('[DEBUG] Found oldest unprocessed data:', rawData ? `ID: ${rawData._id}, Number: ${rawData.number}` : 'None');
    } else {
      return NextResponse.json({ message: "Please provide rawSensorDataNumber, rawSensorDataId, or set processOldestUnprocessed to true" }, { status: 400 });
    }

    if (!rawData) {
      return NextResponse.json({ message: "Raw sensor data not found or no unprocessed data available" }, { status: 404 });
    }

    if (rawData.processedToAngle === true) {
      return NextResponse.json({ message: `Raw sensor data (ID: ${rawData._id}, Number: ${rawData.number}) has already been processed.`, existingAngleData: null }, { status: 200 });
    }

    // rawData.number 유효성 검사
    if (!rawData.number || typeof rawData.number !== 'number') {
      return NextResponse.json({
        message: "Raw sensor data number is missing or invalid",
        rawDataId: rawData._id,
        rawDataNumber: rawData.number
      }, { status: 400 });
    }

    // 디버깅: 센서 데이터 구조 확인
    console.log('Raw sensor data:', JSON.stringify(rawData, null, 2));
    console.log('Sensor values:', JSON.stringify(rawData.sensor_values, null, 2));

    // 센서 데이터 유효성 검사
    if (!rawData.sensor_values) {
      console.error('[ERROR] sensor_values field is missing or null:', rawData);
      return NextResponse.json({ 
        message: "Sensor values not found in raw data", 
        rawDataId: rawData._id,
        rawDataNumber: rawData.number,
        availableFields: Object.keys(rawData || {}),
        debug: "sensor_values field is missing or null"
      }, { status: 400 });
    }

    if (typeof rawData.sensor_values !== 'object') {
      console.error('[ERROR] sensor_values is not an object:', typeof rawData.sensor_values, rawData.sensor_values);
      return NextResponse.json({ 
        message: "Sensor values is not a valid object", 
        rawDataId: rawData._id,
        rawDataNumber: rawData.number,
        sensorValuesType: typeof rawData.sensor_values,
        debug: "sensor_values field exists but is not an object"
      }, { status: 400 });
    }

    const { x_accel, y_accel, z_accel } = rawData.sensor_values;
    if (x_accel === undefined || y_accel === undefined || z_accel === undefined) {
      console.error('[ERROR] Missing acceleration values:', { x_accel, y_accel, z_accel });
      return NextResponse.json({ 
        message: "Missing acceleration values", 
        availableValues: Object.keys(rawData.sensor_values || {}),
        rawDataId: rawData._id,
        rawDataNumber: rawData.number,
        missingFields: {
          x_accel: x_accel === undefined,
          y_accel: y_accel === undefined,
          z_accel: z_accel === undefined
        }
      }, { status: 400 });
    }

    if (typeof x_accel !== 'number' || typeof y_accel !== 'number' || typeof z_accel !== 'number') {
      console.error('[ERROR] Acceleration values are not numbers:', { x_accel: typeof x_accel, y_accel: typeof y_accel, z_accel: typeof z_accel });
      return NextResponse.json({ 
        message: "Acceleration values must be numbers", 
        rawDataId: rawData._id,
        rawDataNumber: rawData.number,
        valueTypes: {
          x_accel: typeof x_accel,
          y_accel: typeof y_accel,
          z_accel: typeof z_accel
        }
      }, { status: 400 });
    }

    // 각도 변환 (convert-to-angle 방식과 동일하게)
    const angleValues = convertAccelToAngles(rawData.sensor_values);
    
    // AngleData 생성 (convert-to-angle 방식 사용)
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

    let angleDataSaved = false;
    let angleDataResult = null;

    if (existingAngleData) {
      // 업데이트
      const updateResult = await angleDataCollection.replaceOne(
        { sensorDataNumber: rawData.number },
        angleData
      );
      angleDataSaved = updateResult.modifiedCount > 0;
      angleDataResult = { action: 'updated', modifiedCount: updateResult.modifiedCount };
    } else {
      // 새로 삽입
      const insertResult = await angleDataCollection.insertOne(angleData);
      angleDataSaved = true;
      angleDataResult = { action: 'inserted', insertedId: insertResult.insertedId };
    }

    // 자세 점수 계산 및 저장 (각도 데이터가 성공적으로 저장된 경우)
    if (angleDataSaved) {
      try {
        // 자세 점수 계산
        const { score, neckScore, backScore, rotationScore, feedback } = calculatePostureScore(angleData);
        
        // PostureScore 객체 생성
        const postureScore = createPostureScore(
          rawData.number,
          score,
          neckScore,
          backScore,
          rotationScore,
          feedback,
          new Date(rawData.timestamp)
        );
        
        // MongoDB에 자세 점수 저장
        const { db } = await connectToDatabase();
        const postureCollection = db.collection('posturescore');
        
        // 중복 체크 (동일한 number가 있는 경우)
        const existingScore = await postureCollection.findOne({ number: postureScore.number });
        
        if (existingScore) {
          // 업데이트
          await postureCollection.updateOne(
            { number: postureScore.number },
            { $set: postureScore }
          );
          console.log(`Posture score updated for sensor data number ${rawData.number}`);
        } else {
          // 새 데이터 삽입
          await postureCollection.insertOne(postureScore);
          console.log(`Posture score inserted for sensor data number ${rawData.number}`);
        }
        
      } catch (postureScoreError) {
        console.error(`Error calculating/saving posture score for sensor data ${rawData.number}:`, postureScoreError);
        // 자세 점수 계산/저장 실패는 전체 처리를 중단하지 않고 경고만 로그
      }
    }
    
    // RawSensorData의 processedToAngle 플래그 업데이트
    await rawSensorCollection.updateOne(
      { _id: rawData._id },
      { $set: { processedToAngle: true, updatedAt: new Date() } }
    );

    return NextResponse.json({
      message: "Successfully converted raw sensor data to angle data and calculated posture score.",
      rawSensorDataId: rawData._id,
      rawSensorDataNumber: rawData.number,
      angleDataResult: angleDataResult,
      calculatedAngles: angleValues,
    }, { status: 201 });

  } catch (error) {
    console.error("[API /api/raw-to-angle] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: "Error processing raw sensor data", error: errorMessage }, { status: 500 });
  }
} 