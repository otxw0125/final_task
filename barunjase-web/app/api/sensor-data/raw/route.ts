//file app/api/sensor-data/raw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRawSensorDataCollection, getAngleDataCollection } from '../../../../lib/db/collections';
import { createRawSensorData, RawSensorData, RawSensorValues } from '../../../../lib/models/RawSensorData';
import { createAngleData, AngleData } from '../../../../lib/models/AngleData';
import { getAccelerationMagnitude } from '../../../../lib/algorithms/angleConverter';
import { convertAccelToAngles } from '../../../../lib/utils/conversion';
import { calculatePostureScore } from '../../posture-score/route';
import { createPostureScore } from '../../../../lib/models/PostureScore';
import { connectToDatabase } from '../../../../lib/db/mongodb';

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
 * 요청 본문 예시 (배열 형식):
 * [
 *   {
 *     "x_accel": 0.12,
 *     "y_accel": 0.53, 
 *     "z_accel": 0.91,
 *     "timestamp": 1748850002839
 *   },
 *   ...
 * ]
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await request.json();
    console.log('Received sensor data:', JSON.stringify(body));
    
    // 배열인지 확인
    if (!Array.isArray(body)) {
      console.error('Sensor data must be an array');
      return NextResponse.json(
        { 
          error: 'Invalid data format', 
          message: 'Data must be an array of sensor readings',
          required: 'Array with elements containing x_accel, y_accel, z_accel (numbers), timestamp (number)'
        },
        { status: 400 }
      );
    }

    if (body.length === 0) {
      return NextResponse.json(
        { error: 'Empty data array' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // 각 센서 데이터 항목을 순서대로 처리
    for (let i = 0; i < body.length; i++) {
      const sensorItem = body[i];
      
      try {
        // 개별 센서 데이터 검증
        const validationResult = validateSensorArrayItem(sensorItem, i);
        if (!validationResult.isValid) {
          console.error(`Sensor data validation error at index ${i}:`, validationResult.message);
          errors.push({
            index: i,
            error: validationResult.message
          });
          continue;
        }

        // 소수점 2자리로 반올림
        const roundedX = Math.round(sensorItem.x_accel * 100) / 100;
        const roundedY = Math.round(sensorItem.y_accel * 100) / 100;
        const roundedZ = Math.round(sensorItem.z_accel * 100) / 100;

        // 가속도 센서 데이터 무결성 검사
        const magnitude = getAccelerationMagnitude(roundedX, roundedY, roundedZ);
        const isValidMagnitude = magnitude >= 0.5 && magnitude <= 20.0; // 정상 범위: 0.5g ~ 20.0g (센서 데이터 고려)
        
        if (!isValidMagnitude) {
          console.warn(`Unusual acceleration magnitude detected: ${magnitude.toFixed(3)}g for data at index ${i}`);
        }

        // 센서 데이터 객체 생성
        const sensorValuesInput: RawSensorValues = {
          x_accel: roundedX,
          y_accel: roundedY,
          z_accel: roundedZ,
        };

        // timestamp를 number로 생성 (배열의 인덱스를 기반으로 고유한 number 생성)
        const dataNumber = sensorItem.timestamp || Date.now() + i;
        
        const rawSensorData = createRawSensorData(
          sensorValuesInput,
          dataNumber,
          undefined,
          new Date(sensorItem.timestamp || Date.now())
        );

        console.log(`Creating raw sensor data for index ${i}:`, JSON.stringify(rawSensorData));

        try {
          // 데이터베이스에 저장
          const collection = await getRawSensorDataCollection();
          
          // 중복 데이터 확인 (timestamp 기반)
          const existingData = await collection.findOne({ number: dataNumber });
          
          let sensorDataSaved = false;
          
          if (existingData) {
            // 기존 데이터 업데이트
            console.log(`Duplicate key detected for index ${i}, updating existing data`);
            const updateResult = await collection.replaceOne(
              { number: dataNumber },
              rawSensorData
            );
            
            if (updateResult.modifiedCount > 0) {
              sensorDataSaved = true;
              results.push({
                index: i,
                success: true,
                action: 'updated',
                number: rawSensorData.number,
                magnitude: Number(magnitude.toFixed(3)),
                isValidMagnitude,
                data: {
                  x_accel: roundedX,
                  y_accel: roundedY,
                  z_accel: roundedZ
                }
              });
            } else {
              errors.push({
                index: i,
                error: `Data with number ${dataNumber} already exists and could not be updated`
              });
            }
          } else {
            // 새 데이터 삽입
            const insertResult = await collection.insertOne(rawSensorData);
            console.log(`Data inserted successfully for index ${i}:`, insertResult.insertedId);
            
            sensorDataSaved = true;
            results.push({
              index: i,
              success: true,
              action: 'inserted',
              id: insertResult.insertedId,
              number: rawSensorData.number,
              magnitude: Number(magnitude.toFixed(3)),
              isValidMagnitude,
              data: {
                x_accel: roundedX,
                y_accel: roundedY,
                z_accel: roundedZ
              }
            });
          }

          // 센서 데이터가 성공적으로 저장된 경우에만 각도 변환 수행
          if (sensorDataSaved) {
            try {
              const angleValues = convertAccelToAngles(sensorValuesInput);
              const createdAngleData = createAngleData(
                dataNumber, // sensorDataNumber
                angleValues.x, // xAngle (좌우 기울기)
                angleValues.y, // yAngle (앞뒤 기울기)
                angleValues.x, // xFiltered (필터링된 좌우 기울기, 동일한 값 사용)
                angleValues.y, // yFiltered (필터링된 앞뒤 기울기, 동일한 값 사용)
                75, // score (기본값)
                new Date(sensorItem.timestamp || Date.now()) // timestamp
              );

              const angleCollection = await getAngleDataCollection();
              
              // 중복 데이터 확인 (sensorDataNumber 기반)
              const existingAngleData = await angleCollection.findOne({ sensorDataNumber: dataNumber });
              
              let angleDataSaved = false;
              
              if (existingAngleData) {
                // 기존 각도 데이터 업데이트
                console.log(`Duplicate angle data detected for index ${i}, updating existing data`);
                const updateAngleResult = await angleCollection.replaceOne(
                  { sensorDataNumber: dataNumber },
                  createdAngleData
                );
                
                if (updateAngleResult.modifiedCount > 0) {
                  console.log(`Angle data updated successfully for index ${i}`);
                  angleDataSaved = true;
                }
              } else {
                // 새 각도 데이터 삽입
                const angleInsertResult = await angleCollection.insertOne(createdAngleData);
                console.log(`Angle data inserted successfully for index ${i}:`, angleInsertResult.insertedId);
                angleDataSaved = true;
              }

              // 각도 데이터가 성공적으로 저장된 경우 자세 점수 계산 및 저장
              if (angleDataSaved) {
                try {
                  // 자세 점수 계산
                  const { score, neckScore, backScore, rotationScore, feedback } = calculatePostureScore(createdAngleData);
                  
                  // PostureScore 객체 생성
                  const postureScore = createPostureScore(
                    dataNumber,
                    score,
                    neckScore,
                    backScore,
                    rotationScore,
                    feedback,
                    new Date(sensorItem.timestamp || Date.now())
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
                    console.log(`Posture score updated for index ${i}`);
                  } else {
                    // 새 데이터 삽입
                    await postureCollection.insertOne(postureScore);
                    console.log(`Posture score inserted for index ${i}`);
                  }
                  
                } catch (postureScoreError) {
                  console.error(`Error calculating/saving posture score for index ${i}:`, postureScoreError);
                  // 자세 점수 계산/저장 실패는 전체 처리를 중단하지 않고 경고만 로그
                }
              }

              // processedToAngle 플래그를 true로 업데이트
              await collection.updateOne(
                { number: dataNumber },
                { $set: { processedToAngle: true, updatedAt: new Date() } }
              );

            } catch (angleError) {
              console.error(`Error converting to angle data for index ${i}:`, angleError);
              // 각도 변환 실패는 전체 처리를 중단하지 않고 경고만 로그
            }
          }
          
        } catch (dbError) {
          console.error(`Database error for index ${i}:`, dbError);
          errors.push({
            index: i,
            error: `Database error: ${(dbError as Error).message}`
          });
        }

      } catch (itemError) {
        console.error(`Error processing sensor data at index ${i}:`, itemError);
        errors.push({
          index: i,
          error: `Processing error: ${(itemError as Error).message}`
        });
      }
    }

    // 결과 응답
    const hasErrors = errors.length > 0;
    const hasSuccesses = results.length > 0;

    if (hasSuccesses && !hasErrors) {
      // 모든 데이터가 성공적으로 처리됨
      return NextResponse.json(
        { 
          success: true, 
          message: `Successfully processed ${results.length} sensor data items`,
          totalProcessed: body.length,
          results: results
        },
        { status: 201 }
      );
    } else if (hasSuccesses && hasErrors) {
      // 일부 성공, 일부 실패
      return NextResponse.json(
        { 
          success: false, 
          message: `Partially processed ${results.length}/${body.length} sensor data items`,
          totalProcessed: body.length,
          successCount: results.length,
          errorCount: errors.length,
          results: results,
          errors: errors
        },
        { status: 207 } // Multi-Status
      );
    } else {
      // 모든 데이터 처리 실패
      return NextResponse.json(
        { 
          success: false, 
          message: `Failed to process all ${body.length} sensor data items`,
          totalProcessed: body.length,
          errorCount: errors.length,
          errors: errors
        },
        { status: 400 }
      );
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
    
    // 소수점 2자리로 반올림
    const roundedX = Math.round(body.accel.x * 100) / 100;
    const roundedY = Math.round(body.accel.y * 100) / 100;
    const roundedZ = Math.round(body.accel.z * 100) / 100;
    
    // 업데이트할 데이터 객체 생성
    const updatedSensorValues: RawSensorValues = {
      x_accel: roundedX,
      y_accel: roundedY,
      z_accel: roundedZ,
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
    
    const magnitude = getAccelerationMagnitude(roundedX, roundedY, roundedZ);
    
    return NextResponse.json({
      success: true,
      message: 'Sensor data updated successfully',
      data: {
        number: updatedData.number,
        magnitude: Number(magnitude.toFixed(3)),
        modified: updateResult.modifiedCount > 0,
        rounded_values: {
          x_accel: roundedX,
          y_accel: roundedY,
          z_accel: roundedZ
        }
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
 * 배열 형식 센서 데이터 항목 유효성 검증 함수
 * 
 * @param data 검증할 개별 센서 데이터 항목
 * @param index 배열에서의 인덱스 (에러 메시지용)
 * @returns 검증 결과 객체
 */
function validateSensorArrayItem(data: any, index: number): { isValid: boolean; message?: string } {
  // 기본 타입 검증
  if (!data || typeof data !== 'object') {
    return { isValid: false, message: `Item at index ${index} must be an object` };
  }
  
  // 가속도 값 검증
  const { x_accel, y_accel, z_accel } = data;
  if (typeof x_accel !== 'number' || typeof y_accel !== 'number' || typeof z_accel !== 'number') {
    return { isValid: false, message: `Item at index ${index}: x_accel, y_accel, and z_accel must be numbers` };
  }
  
  // 유한한 수인지 검증
  if (!isFinite(x_accel) || !isFinite(y_accel) || !isFinite(z_accel)) {
    return { isValid: false, message: `Item at index ${index}: acceleration values must be finite numbers` };
  }
  
  // 합리적인 범위 내인지 검증 (-20g ~ +20g)
  const maxAccel = 20.0;
  if (Math.abs(x_accel) > maxAccel || Math.abs(y_accel) > maxAccel || Math.abs(z_accel) > maxAccel) {
    return { isValid: false, message: `Item at index ${index}: acceleration values must be within ±${maxAccel}g range` };
  }
  
  // timestamp 검증 (선택적 필드, 있으면 숫자여야 함)
  if (data.timestamp && (typeof data.timestamp !== 'number' || !isFinite(data.timestamp))) {
    return { isValid: false, message: `Item at index ${index}: timestamp must be a valid number (unix timestamp)` };
  }
  
  return { isValid: true };
}

/**
 * 센서 데이터 유효성 검증 함수 (기존 단일 객체 형식용 - PUT 요청 등에서 사용)
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
  
  // 합리적인 범위 내인지 검증 (-20g ~ +20g)
  const maxAccel = 20.0;
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