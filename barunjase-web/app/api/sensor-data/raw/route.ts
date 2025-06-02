//file app/api/sensor-data/raw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRawSensorDataCollection, getAngleDataCollection } from '../../../../lib/db/collections';
import { createRawSensorData, RawSensorData, RawSensorValues } from '../../../../lib/models/RawSensorData';
import { getAccelerationMagnitude } from '../../../../lib/algorithms/angleConverter';
import { convertAccelToAngles } from '../../../../lib/utils/conversion';
import { generatePostureFeedbackFromAngleData } from '../../../../lib/utils/postureEvaluator';
import { AngleData } from '../../../../lib/models/AngleData';

/**
 * 센서 데이터 수집 API 엔드포인트
 * 
 * 이 API는 센서에서 전송되는 원시 가속도 데이터를 수집하고 MongoDB에 저장합니다.
 * POST 요청으로 데이터를 저장하고, GET 요청으로 최근 데이터를 조회할 수 있습니다.
 */

/**
 * POST 요청 핸들러 - 센서 데이터 저장
 * 
 * 클라이언트(센서 또는 모바일 앱)에서 전송하는 가속도 센서 데이터를 받아
 * 검증 후 데이터베이스에 저장합니다.
 * 
 * 요청 본문 예시:
 * {
 *   "number": 1001,
 *   "accel": {
 *     "x": 0.1,
 *     "y": 0.5, 
 *     "z": 0.9
 *   },
 *   "timestamp": "2023-01-01T12:00:00Z" // 선택적
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await request.json();
    console.log('Received sensor data:', JSON.stringify(body));
    
    // 필수 필드 검증
    const validationResult = validateSensorData(body);
    if (!validationResult.isValid) {
      console.error('Sensor data validation error:', validationResult.message);
      return NextResponse.json(
        { 
          error: 'Invalid data format', 
          message: validationResult.message,
          required: 'number (integer), accel.x (number), accel.y (number), accel.z (number)'
        },
        { status: 400 }
      );
    }

        // 소수점 2자리로 반올림
    const roundedX = Math.round(body.accel.x * 100) / 100;
    const roundedY = Math.round(body.accel.y * 100) / 100;
    const roundedZ = Math.round(body.accel.z * 100) / 100;
    // 가속도 센서 데이터 무결성 검사
    try {
      const magnitude = getAccelerationMagnitude(roundedX, roundedY, roundedZ);
      const isValidMagnitude = magnitude >= 0.5 && magnitude <= 2.0; // 정상 범위: 0.5g ~ 2.0g
      
      if (!isValidMagnitude) {
        console.warn(`Unusual acceleration magnitude detected: ${magnitude.toFixed(3)}g for data #${body.number}`);
      }

      // 센서 데이터 객체 생성 (반올림된 값 사용)
      const sensorValuesInput: RawSensorValues = {
        x_accel: roundedX,
        y_accel: roundedY,
        z_accel: roundedZ,
      };
      const rawSensorData = createRawSensorData(
        sensorValuesInput,
        body.number,
        undefined,
        body.timestamp ? new Date(body.timestamp) : new Date()
      );
      console.log('Creating raw sensor data:', JSON.stringify(rawSensorData));

      try {
        // 데이터베이스에 저장
        const collection = await getRawSensorDataCollection();
        console.log('Connected to database collection');
        
        // 중복 데이터 확인
        const existingData = await collection.findOne({ number: body.number });
        
        if (existingData) {
          // 기존 데이터 업데이트
          console.log('Duplicate key detected, updating existing data');
          const updateResult = await collection.replaceOne(
            { number: body.number },
            rawSensorData
          );
          
          if (updateResult.modifiedCount > 0) {
            console.log('Data updated successfully');
            
            // 각도 변환
            const calculatedAngles = convertAccelToAngles(sensorValuesInput);
            
            // 자세 피드백 생성
            const feedbackInput = {
              angles: calculatedAngles,
              timestamp: rawSensorData.timestamp
            };
            const postureFeedback = generatePostureFeedbackFromAngleData(feedbackInput);
            
            // AngleData 생성 및 저장
            try {
              const angleDataCollection = await getAngleDataCollection();
              const newAngleEntry: Omit<AngleData, '_id'> = {
                sensorDataNumber: rawSensorData.number,
                userId: rawSensorData.userId,
                angles: calculatedAngles,
                timestamp: new Date(rawSensorData.timestamp),
                overallScore: postureFeedback.overallScore,
                riskLevel: postureFeedback.riskLevel || 'unknown',
                summaryMessage: postureFeedback.summaryMessage,
                detailedAdvice: postureFeedback.detailedAdvice,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              
              await angleDataCollection.insertOne(newAngleEntry);
              console.log('AngleData created and saved successfully');
            } catch (angleError) {
              console.error('Error saving AngleData:', angleError);
            }
            
            return NextResponse.json(
              { 
                success: true, 
                message: 'Sensor data updated and processed successfully',
                data: { 
                  number: rawSensorData.number,
                  updated: true,
                  magnitude: Number(magnitude.toFixed(3)),
                  isValidMagnitude,
                  x_angle: calculatedAngles.x,
                  y_angle: calculatedAngles.y,
                  z_angle: calculatedAngles.z,
                  overallScore: postureFeedback.overallScore,
                  riskLevel: postureFeedback.riskLevel,
                  summaryMessage: postureFeedback.summaryMessage
                }
              },
              { status: 200 }
            );
          } else {
            console.error('Update failed for duplicate key:', body.number);
            return NextResponse.json(
              { error: `Data with number ${body.number} already exists and could not be updated` },
              { status: 409 }
            );
          }
        } else {
          // 새 데이터 삽입
          const insertResult = await collection.insertOne(rawSensorData);
          console.log('Data inserted successfully:', insertResult.insertedId);
          
          // 각도 변환
          const calculatedAngles = convertAccelToAngles(sensorValuesInput);
          
          // 자세 피드백 생성
          const feedbackInput = {
            angles: calculatedAngles,
            timestamp: rawSensorData.timestamp
          };
          const postureFeedback = generatePostureFeedbackFromAngleData(feedbackInput);
          
          // AngleData 생성 및 저장
          try {
            const angleDataCollection = await getAngleDataCollection();
            const newAngleEntry: Omit<AngleData, '_id'> = {
              sensorDataNumber: rawSensorData.number,
              userId: rawSensorData.userId,
              angles: calculatedAngles,
              timestamp: new Date(rawSensorData.timestamp),
              overallScore: postureFeedback.overallScore,
              riskLevel: postureFeedback.riskLevel || 'unknown',
              summaryMessage: postureFeedback.summaryMessage,
              detailedAdvice: postureFeedback.detailedAdvice,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            await angleDataCollection.insertOne(newAngleEntry);
            console.log('AngleData created and saved successfully');
          } catch (angleError) {
            console.error('Error saving AngleData:', angleError);
          }
          
          // 저장 성공 응답
          return NextResponse.json(
            { 
              success: true, 
              message: 'Sensor data saved and processed successfully',
              data: { 
                id: insertResult.insertedId,
                number: rawSensorData.number,
                magnitude: Number(magnitude.toFixed(3)),
                isValidMagnitude,
                x_angle: calculatedAngles.x,
                y_angle: calculatedAngles.y,
                z_angle: calculatedAngles.z,
                overallScore: postureFeedback.overallScore,
                riskLevel: postureFeedback.riskLevel,
                summaryMessage: postureFeedback.summaryMessage
              }
            },
            { status: 201 }
          );
        }
      } catch (error) {
        console.error('Database error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error processing sensor data:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('Error saving sensor data:', error);
    
    // 요청 본문 파싱 오류
    if (error instanceof SyntaxError) {
      console.error('JSON syntax error:', error.message);
      return NextResponse.json(
        { error: 'Invalid JSON format in request body' },
        { status: 400 }
      );
    }
    
    // 기타 서버 오류
    return NextResponse.json(
      { 
        error: 'Failed to save sensor data',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET 요청 핸들러 - 센서 데이터 조회
 * 
 * 저장된 센서 데이터를 조회합니다. 페이지네이션을 지원하며,
 * 최신 데이터부터 정렬하여 반환합니다.
 * 
 * 쿼리 파라미터:
 * - limit: 조회할 데이터 개수 (기본값: 10, 최대값: 100)
 * - offset: 건너뛸 데이터 개수 (기본값: 0)
 * - startNumber: 시작 번호 (해당 번호 이상의 데이터만 조회)
 * - endNumber: 종료 번호 (해당 번호 이하의 데이터만 조회)
 * 
 * 응답 예시:
 * {
 *   "success": true,
 *   "data": [...],
 *   "pagination": {
 *     "total": 150,
 *     "limit": 10,
 *     "offset": 0,
 *     "hasMore": true
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const startNumber = searchParams.get('startNumber') ? parseInt(searchParams.get('startNumber')!) : undefined;
    const endNumber = searchParams.get('endNumber') ? parseInt(searchParams.get('endNumber')!) : undefined;
    
    // 데이터베이스 쿼리 조건 구성
    const query: any = {};
    if (startNumber !== undefined || endNumber !== undefined) {
      query.number = {};
      if (startNumber !== undefined) query.number.$gte = startNumber;
      if (endNumber !== undefined) query.number.$lte = endNumber;
    }
    
    const collection = await getRawSensorDataCollection();
    
    // 전체 개수 조회 (페이지네이션 정보를 위해)
    const totalCount = await collection.countDocuments(query);
    
    // 데이터 조회 (최신순으로 정렬)
    const data = await collection
      .find(query)
      .sort({ timestamp: -1, number: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    
    // 각 데이터에 가속도 크기 정보 추가
    const enhancedData = data.map(item => ({
      ...item,
      // sensor_values가 있고, 그 안에 x_accel, y_accel, z_accel이 있는지 확인
      magnitude: item.sensor_values && typeof item.sensor_values.x_accel === 'number' 
        ? Number(getAccelerationMagnitude(item.sensor_values.x_accel, item.sensor_values.y_accel, item.sensor_values.z_accel).toFixed(3))
        : null // sensor_values가 없거나 형식이 다르면 null 처리
    }));
    
    // 성공 응답
    return NextResponse.json({
      success: true,
      data: enhancedData,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      },
      query: {
        startNumber,
        endNumber,
        appliedFilters: Object.keys(query).length > 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sensor data',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT 요청 핸들러 - 특정 센서 데이터 업데이트
 * 
 * 기존에 저장된 센서 데이터를 업데이트합니다.
 * number 필드를 기준으로 데이터를 찾아 업데이트합니다.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 필수 필드 검증 (number는 업데이트 대상 식별을 위해 필수)
    if (!body.number || typeof body.number !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid number field for update' },
        { status: 400 }
      );
    }
    
    const validationResult = validateSensorData(body);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { error: 'Invalid data format', message: validationResult.message },
        { status: 400 }
      );
    }
    
    // 업데이트할 데이터 객체 생성
    const updatedSensorValues: RawSensorValues = {
      x_accel: body.accel.x,
      y_accel: body.accel.y,
      z_accel: body.accel.z,
    };
    const updatedData = createRawSensorData(
      updatedSensorValues,
      body.number,
      undefined,
      body.timestamp ? new Date(body.timestamp) : new Date()
    );
    
    const collection = await getRawSensorDataCollection();
    
    // 데이터 업데이트 실행
    const updateResult = await collection.replaceOne(
      { number: body.number },
      updatedData
    );
    
    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: `No data found with number ${body.number}` },
        { status: 404 }
      );
    }
    
    const magnitude = getAccelerationMagnitude(body.accel.x, body.accel.y, body.accel.z);
    
    return NextResponse.json({
      success: true,
      message: 'Sensor data updated successfully',
      data: {
        number: updatedData.number,
        magnitude: Number(magnitude.toFixed(3)),
        modified: updateResult.modifiedCount > 0
      }
    });
    
  } catch (error) {
    console.error('Error updating sensor data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update sensor data',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE 요청 핸들러 - 센서 데이터 삭제
 * 
 * 특정 번호의 센서 데이터를 삭제하거나, 쿼리 조건에 맞는 데이터를 일괄 삭제합니다.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const number = searchParams.get('number');
    const startNumber = searchParams.get('startNumber');
    const endNumber = searchParams.get('endNumber');
    const olderThan = searchParams.get('olderThan'); // ISO 날짜 문자열
    
    if (!number && !startNumber && !endNumber && !olderThan) {
      return NextResponse.json(
        { error: 'At least one deletion criterion must be specified (number, startNumber, endNumber, or olderThan)' },
        { status: 400 }
      );
    }
    
    const collection = await getRawSensorDataCollection();
    
    // 삭제 쿼리 구성
    const deleteQuery: any = {};
    
    if (number) {
      deleteQuery.number = parseInt(number);
    } else {
      if (startNumber || endNumber) {
        deleteQuery.number = {};
        if (startNumber) deleteQuery.number.$gte = parseInt(startNumber);
        if (endNumber) deleteQuery.number.$lte = parseInt(endNumber);
      }
      
      if (olderThan) {
        deleteQuery.timestamp = { $lt: new Date(olderThan) };
      }
    }
    
    // 삭제 실행
    const deleteResult = await collection.deleteMany(deleteQuery);
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} records`,
      deletedCount: deleteResult.deletedCount,
      query: deleteQuery
    });
    
  } catch (error) {
    console.error('Error deleting sensor data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete sensor data',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * 센서 데이터 유효성 검증 함수
 * 
 * @param data 검증할 데이터 객체
 * @returns 검증 결과 객체
 */
function validateSensorData(data: any): { isValid: boolean; message?: string } {
  // number 필드 검증
  if (!data.number || typeof data.number !== 'number' || !Number.isInteger(data.number)) {
    return { isValid: false, message: 'number field must be an integer' };
  }
  
  // accel 객체 존재 여부 검증
  if (!data.accel || typeof data.accel !== 'object') {
    return { isValid: false, message: 'accel field must be an object' };
  }
  
  // 가속도 값 검증
  const { x, y, z } = data.accel;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
    return { isValid: false, message: 'accel.x, accel.y, and accel.z must be numbers' };
  }
  
  // 유한한 수인지 검증
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
    return { isValid: false, message: 'acceleration values must be finite numbers' };
  }
  
  // 합리적인 범위 내인지 검증 (-10g ~ +10g)
  const maxAccel = 10.0;
  if (Math.abs(x) > maxAccel || Math.abs(y) > maxAccel || Math.abs(z) > maxAccel) {
    return { isValid: false, message: `acceleration values must be within ±${maxAccel}g range` };
  }
  
  // timestamp 검증 (선택적 필드)
  if (data.timestamp && isNaN(new Date(data.timestamp).getTime())) {
    return { isValid: false, message: 'timestamp must be a valid ISO date string' };
  }
  
  return { isValid: true };
}

/**
 * 요청 속도 제한을 위한 간단한 메모리 기반 레이트 리미터
 * (실제 운영 환경에서는 Redis 등 외부 저장소 사용 권장)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // 분당 최대 요청 수
const WINDOW_MS = 60 * 1000; // 1분

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientId);
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }
  
  if (clientData.count >= RATE_LIMIT) {
    return false;
  }
  
  clientData.count++;
  return true;
}

// 주기적으로 레이트 리미트 맵 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const [clientId, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(clientId);
    }
  }
}, 5 * 60 * 1000); // 5분마다 정리