import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from "@/lib/db/mongodb";
import { getAngleDataCollection, getRawSensorDataCollection } from "@/lib/db/collections";
import { RawSensorData, RawSensorDataCollection } from "@/lib/models/RawSensorData";
import { AngleData, AngleDataCollection } from "@/lib/models/AngleData";
import { convertAccelToAngles } from "@/lib/utils/conversion";
import { generatePostureFeedbackFromAngleData } from "@/lib/utils/postureEvaluator";
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

    // 각도 변환
    const calculatedAngles = convertAccelToAngles(rawData.sensor_values);

    // 자세 피드백 생성
    const feedbackInput = {
      angles: calculatedAngles,
      // rawData.timestamp가 Date 객체가 아닐 수 있으므로, Date 객체로 변환 시도
      timestamp: typeof rawData.timestamp === 'string' ? rawData.timestamp : new Date(rawData.timestamp).toISOString(),
    };
    const postureFeedback = generatePostureFeedbackFromAngleData(feedbackInput);

    // AngleData 객체 직접 구성 (createAngleData 헬퍼 사용 X)
    const newAngleEntry: Omit<AngleData, '_id'> = {
      sensorDataNumber: rawData.number,
      userId: rawData.userId, // userId가 있다면 전달
      angles: calculatedAngles,
      timestamp: new Date(rawData.timestamp), // 원본 RawData의 timestamp 저장 (Date 객체로)
      
      // generatePostureFeedbackFromAngleData 결과 저장
      overallScore: postureFeedback.overallScore,
      riskLevel: postureFeedback.riskLevel,
      summaryMessage: postureFeedback.summaryMessage,
      detailedAdvice: postureFeedback.detailedAdvice,
      
      // 기존 filtered 및 scoreData 필드는 일단 undefined 또는 기본값으로 둠
      // 필요시 이 값들도 postureFeedback에서 파생하여 채울 수 있음
      // filtered: undefined, 
      // scoreData: undefined,

      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // AngleData 저장
    const angleDataInsertResult = await angleDataCollection.insertOne(newAngleEntry);
    
    // RawSensorData의 processedToAngle 플래그 업데이트
    await rawSensorCollection.updateOne(
      { _id: rawData._id },
      { $set: { processedToAngle: true, updatedAt: new Date() } }
    );

    return NextResponse.json({
      message: "Successfully converted raw sensor data to angle data and saved.",
      rawSensorDataId: rawData._id,
      rawSensorDataNumber: rawData.number,
      createdAngleDataId: angleDataInsertResult.insertedId,
      calculatedAngles: calculatedAngles,
    }, { status: 201 });

  } catch (error) {
    console.error("[API /api/raw-to-angle] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: "Error processing raw sensor data", error: errorMessage }, { status: 500 });
  }
} 