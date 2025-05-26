import { Collection, InsertOneResult, InsertManyResult, ObjectId } from 'mongodb';
import type { NextApiRequest, NextApiResponse } from 'next';
// 기존 DB 연결 로직 대신 lib의 모듈 사용
import { connectToDatabase } from '../../lib/db/mongodb'; 
import { getRawSensorDataCollection, getAngleDataCollection } from '../../lib/db/collections';
// 모델 정의 가져오기 (DB 저장용 스키마 위주로)
import { RawSensorData, createRawSensorData } from '../../lib/models/RawSensorData'; 
import { AngleData, createAngleData } from '../../lib/models/AngleData';
// 각도 변환 알고리즘 가져오기
import { accelerationToAngle, AngleResult } from '../../lib/algorithms/angleConverter';

// 요청 본문의 센서 데이터 (앱에서 직접 보내는 필드)
interface SensorDataInputFromApp {
  number?: number;
  userId?: string | null;
  x_accel: number; 
  y_accel: number;
  z_accel: number;
  timestamp?: number | string; 
  processedToAngle?: boolean; // 이 필드는 서버에서 관리하거나, 클라이언트에서 명시적 요청 시 사용
  createdAt?: string | number | Date; 
}

// API 응답용 RawSensorData (날짜는 string, _id도 string)
interface RawSensorDataForApiResponse extends Omit<RawSensorData, '_id' | 'timestamp' | 'createdAt' | 'updatedAt'> {
  _id?: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
}

// API 응답용 AngleData (날짜는 string, _id도 string)
interface AngleDataForApiResponse extends Omit<AngleData, '_id' | 'timestamp' | 'createdAt' | 'updatedAt'> {
    _id?: string;
    timestamp: string;
    createdAt?: string;
    updatedAt?: string;
}

// API 응답 타입 정의
interface ApiResponseError {
  success: false;
  message: string;
  error?: string;
  details?: string;
  timestamp: string;
}

interface ApiMethodNotAllowedResponse {
  success: false;
  message: string;
  allowed_methods: string[];
}

interface AngleProcessingResult {
    insertedId?: string;
    sample?: AngleDataForApiResponse; // 성공 시에만 존재
    message: string; // 항상 메시지 제공 (성공/실패/오류)
}

// POST 성공 응답: RawSensorData 저장 결과 + AngleData 저장 결과 (선택적)
interface ApiPostSuccessResponse {
  success: true;
  message: string;
  rawSensorDataResult: {
    insertedCount: number;
    insertedIds: string[];
    sample: RawSensorDataForApiResponse;
  };
  angleDataResult?: AngleProcessingResult;
  timestamp: string;
}

// GET 성공 응답
interface ApiGetSuccessResponse {
  success: true;
  data: RawSensorDataForApiResponse[]; 
  stats: {
    total_count: number;
    time_range: { start: string | null; end: string | null; } | null;
  };
  latest_sample: RawSensorDataForApiResponse | null; 
  query: { filter: any; limit: number; sort: any; };
  timestamp: string;
}

type SensorDataApiResponse = ApiPostSuccessResponse | ApiGetSuccessResponse | ApiResponseError | ApiMethodNotAllowedResponse;

// Helper to convert DB document to API response format (RawSensorData)
function convertRawDocToApiResponse(doc: RawSensorData): RawSensorDataForApiResponse {
  return {
    ...doc,
    _id: doc._id?.toHexString(),
    timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : String(doc.timestamp),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : undefined,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : undefined,
  };
}

// Helper to convert DB document to API response format (AngleData)
function convertAngleDocToApiResponse(doc: AngleData): AngleDataForApiResponse {
    return {
        ...doc,
        _id: doc._id?.toHexString(),
        timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : String(doc.timestamp),
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : undefined,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : undefined,
    };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SensorDataApiResponse>
) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const rawSensorCollection = await getRawSensorDataCollection();
      const angleDataCollection = await getAngleDataCollection();

      const requestDataArray: SensorDataInputFromApp[] = Array.isArray(req.body) ? req.body : [req.body];
      const now = new Date();
      let isSingleInsert = requestDataArray.length === 1;

      const rawDocsToInsert: Omit<RawSensorData, '_id'>[] = [];
      for (const data of requestDataArray) {
        if (data.x_accel === undefined || data.x_accel === null) {
          return res.status(400).json({
            success: false,
            message: 'x_accel 값이 필요합니다.',
            error: 'Bad Request: Missing x_accel',
            timestamp: new Date().toISOString()
          });
        }
        if (data.y_accel === undefined || data.y_accel === null) {
          return res.status(400).json({
            success: false,
            message: 'y_accel 값이 필요합니다.',
            error: 'Bad Request: Missing y_accel',
            timestamp: new Date().toISOString()
          });
        }
        if (data.z_accel === undefined || data.z_accel === null) {
          return res.status(400).json({
            success: false,
            message: 'z_accel 값이 필요합니다.',
            error: 'Bad Request: Missing z_accel',
            timestamp: new Date().toISOString()
          });
        }
        
        const x = parseFloat(String(data.x_accel));
        const y = parseFloat(String(data.y_accel));
        const z = parseFloat(String(data.z_accel));

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          return res.status(400).json({
            success: false,
            message: 'x_accel, y_accel, z_accel 값은 유효한 숫자여야 합니다.',
            error: 'Bad Request: Invalid sensor values',
            timestamp: new Date().toISOString()
          });
        }

        let tsInput: Date | string;
        if (typeof data.timestamp === 'number') tsInput = new Date(data.timestamp);
        else if (typeof data.timestamp === 'string') tsInput = data.timestamp;
        else tsInput = now;

        rawDocsToInsert.push(createRawSensorData(
          { x_accel: x, y_accel: y, z_accel: z },
          data.number,
          data.userId || undefined,
          tsInput
        ));
      }

      let rawInsertResult: InsertOneResult<RawSensorData> | InsertManyResult<RawSensorData>;
      if (isSingleInsert) {
        rawInsertResult = await rawSensorCollection.insertOne(rawDocsToInsert[0] as RawSensorData);
      } else {
        rawInsertResult = await rawSensorCollection.insertMany(rawDocsToInsert as RawSensorData[]);
      }
      let insertedRawIdsAsStrings: string[];
      let firstInsertedRawId: ObjectId | undefined;
      if (isSingleInsert && 'insertedId' in rawInsertResult && rawInsertResult.insertedId) {
        insertedRawIdsAsStrings = [rawInsertResult.insertedId.toHexString()];
        firstInsertedRawId = rawInsertResult.insertedId;
      } else if (!isSingleInsert && 'insertedIds' in rawInsertResult) {
        insertedRawIdsAsStrings = Object.values(rawInsertResult.insertedIds).map(id => id.toHexString());
        firstInsertedRawId = Object.values(rawInsertResult.insertedIds)[0];
      } else {
        insertedRawIdsAsStrings = [];
      }
      
      const firstSavedRawDocInitial = firstInsertedRawId ? await rawSensorCollection.findOne({ _id: firstInsertedRawId }) : null;
      if (!firstSavedRawDocInitial) throw new Error('저장된 원본 센서 데이터를 가져오지 못했습니다.');

      let apiSampleRawDoc = convertRawDocToApiResponse(firstSavedRawDocInitial!);

      const rawSensorDataResponsePart = {
        insertedCount: isSingleInsert ? rawInsertResult.acknowledged ? 1 : 0 : (rawInsertResult as InsertManyResult<RawSensorData>).insertedCount,
        insertedIds: insertedRawIdsAsStrings,
        sample: apiSampleRawDoc 
      };

      let angleDataResponsePart: AngleProcessingResult | undefined;
      if (isSingleInsert && requestDataArray.length > 0) {
        const input = requestDataArray[0];
        const sensorValuesForAngle = rawDocsToInsert[0].sensor_values;

        try {
          const angles: AngleResult = accelerationToAngle(sensorValuesForAngle.x_accel, sensorValuesForAngle.y_accel, sensorValuesForAngle.z_accel);
          const newAngleData = createAngleData(
            firstSavedRawDocInitial.number!,
            angles.X, angles.Y, angles.Z,
            angles.X, angles.Y, angles.Z, 
            75, 
            firstSavedRawDocInitial.timestamp instanceof Date ? firstSavedRawDocInitial.timestamp : new Date(firstSavedRawDocInitial.timestamp)
          );
          newAngleData.userId = firstSavedRawDocInitial.userId;

          const angleInsertResult = await angleDataCollection.insertOne(newAngleData as AngleData);
          
          if (angleInsertResult.insertedId) {
            const savedAngleDoc = await angleDataCollection.findOne({ _id: angleInsertResult.insertedId });
            if (savedAngleDoc) {
                angleDataResponsePart = {
                    insertedId: angleInsertResult.insertedId.toHexString(),
                    sample: convertAngleDocToApiResponse(savedAngleDoc),
                    message: '각도 데이터 저장 성공'
                };
                await rawSensorCollection.updateOne(
                    { _id: firstSavedRawDocInitial._id }, 
                    { $set: { processedToAngle: true, updatedAt: new Date() } }
                );
                rawSensorDataResponsePart.sample.processedToAngle = true;
            } else {
                 angleDataResponsePart = { message: '각도 데이터 저장 후 조회 실패' };
            }
          } else {
            angleDataResponsePart = { message: '각도 데이터 저장 실패 (ID 없음)' };
          }
        } catch (angleError: any) {
          console.error('각도 변환 또는 저장 실패:', angleError);
          angleDataResponsePart = { message: `각도 처리 중 오류: ${angleError.message}` };
        }
      }

      res.status(201).json({
        success: true,
        message: `원본 센서 데이터 ${rawSensorDataResponsePart.insertedCount}개 저장 완료.` + 
                 (angleDataResponsePart ? ` ${angleDataResponsePart.message}` : ''),
        rawSensorDataResult: rawSensorDataResponsePart,
        angleDataResult: angleDataResponsePart,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('POST 요청 처리 중 심각한 서버 오류:', error);
      res.status(500).json({
        success: false,
        message: '데이터 저장 중 심각한 서버 오류 발생',
        error: error.message,
        details: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  } 
  
  else if (req.method === 'GET') {
    try {
      const rawSensorCollection = await getRawSensorDataCollection();

      const { 
        limit = '100', 
        start_time, end_time, sort = 'desc',
        userId // userId 필터 추가
      } = req.query as { [key: string]: string | undefined }; 

      const filter: any = {};
      if (userId) filter.userId = userId;
      if (start_time) {
        const startTimeNum = parseInt(start_time as string);
        if (!isNaN(startTimeNum)) filter.timestamp = { ...filter.timestamp, $gte: new Date(startTimeNum) };
      }
      if (end_time) {
        const endTimeNum = parseInt(end_time as string);
        if (!isNaN(endTimeNum)) filter.timestamp = { ...filter.timestamp, $lte: new Date(endTimeNum) };
      }

      const sortOption: any = (sort as string) === 'asc' ? { timestamp: 1 } : { timestamp: -1 };
      const numLimit = parseInt(limit as string);
      const finalLimit = isNaN(numLimit) ? 100 : numLimit;

      const dataFromDb: RawSensorData[] = await rawSensorCollection
        .find(filter)
        .sort(sortOption)
        .limit(finalLimit)
        .toArray();

      const dataForApi = dataFromDb.map(convertRawDocToApiResponse);

      const stats = {
        total_count: dataForApi.length,
        time_range: null as { start: string | null; end: string | null; } | null
      };
      if (dataForApi.length > 0) {
        const timestamps = dataForApi.map(item => new Date(item.timestamp).getTime());
        stats.time_range = {
            start: new Date(Math.min(...timestamps)).toISOString(),
            end: new Date(Math.max(...timestamps)).toISOString()
        }
      }

      let latestSampleForApi: RawSensorDataForApiResponse | null = null;
      if (dataForApi.length > 0) {
        latestSampleForApi = dataForApi[0]; 
      }

      res.status(200).json({
        success: true,
        data: dataForApi, 
        stats: stats,
        latest_sample: latestSampleForApi, 
        query: { filter, limit: finalLimit, sort: sortOption },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('GET 요청 처리 실패:', error);
      res.status(500).json({
        success: false,
        message: '데이터 조회 중 서버 오류 발생',
        error: error.message,
        details: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  else {
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
      allowed_methods: ['GET', 'POST', 'OPTIONS']
    });
  }
} 