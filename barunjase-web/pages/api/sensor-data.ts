import { Collection, InsertOneResult, InsertManyResult, ObjectId } from 'mongodb';
import type { NextApiRequest, NextApiResponse } from 'next';
// 기존 DB 연결 로직 대신 lib의 모듈 사용
import { connectToDatabase } from '../../lib/db/mongodb'; 
import { getRawSensorDataCollection, getAngleDataCollection, getPostureScoreCollection } from '../../lib/db/collections';
// 모델 정의 가져오기 (DB 저장용 스키마 위주로)
import { RawSensorData, createRawSensorData } from '../../lib/models/RawSensorData'; 
import { AngleData, createAngleData } from '../../lib/models/AngleData';
import { PostureScore } from '../../lib/models/PostureScore';
// 각도 변환 알고리즘 가져오기
import { accelerationToAngle, AngleResult } from '../../lib/algorithms/angleConverter';
// 자세 분석 알고리즘 가져오기
import { analyzePostureFromAngles, createPostureScoreFromAnalysis } from '../../lib/algorithms/postureAnalyzer';

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

// API 응답용 PostureScore (날짜는 string, _id도 string)
interface PostureScoreForApiResponse extends Omit<PostureScore, '_id' | 'timestamp'> {
    _id?: string;
    timestamp: string;
}

interface PostureScoreProcessingResult {
    insertedId?: string;
    sample?: PostureScoreForApiResponse; // 성공 시에만 존재
    message: string; // 항상 메시지 제공 (성공/실패/오류)
}

// POST 성공 응답: RawSensorData 저장 결과 + AngleData 저장 결과 + PostureScore 저장 결과 (선택적)
interface ApiPostSuccessResponse {
  success: true;
  message: string;
  rawSensorDataResult: {
    insertedCount: number;
    insertedIds: string[];
    sample: RawSensorDataForApiResponse;
  };
  angleDataResult?: AngleProcessingResult | AngleProcessingResult[];
  postureScoreResult?: PostureScoreProcessingResult | PostureScoreProcessingResult[];
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

// Helper to convert DB document to API response format (PostureScore)
function convertPostureScoreDocToApiResponse(doc: PostureScore): PostureScoreForApiResponse {
    return {
        ...doc,
        _id: doc._id?.toHexString(),
        timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : String(doc.timestamp),
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
      const postureScoreCollection = await getPostureScoreCollection();

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

      let angleDataResponsePart: AngleProcessingResult | AngleProcessingResult[] | undefined;
      let postureScoreResponsePart: PostureScoreProcessingResult | PostureScoreProcessingResult[] | undefined;
      
      // 단일 또는 배열 모두에 대해 각도 변환 및 자세 점수 생성 처리
      if (requestDataArray.length > 0) {
        if (isSingleInsert) {
          // 단일 데이터 처리
          const processedResult = await processSingleSensorData(
            rawDocsToInsert[0], 
            firstSavedRawDocInitial, 
            angleDataCollection, 
            postureScoreCollection, 
            rawSensorCollection
          );
          angleDataResponsePart = processedResult.angleResult;
          postureScoreResponsePart = processedResult.postureResult;
          if (processedResult.flagUpdated) {
            rawSensorDataResponsePart.sample.processedToAngle = true;
          }
        } else {
          // 배열 데이터 처리
          const angleResults: AngleProcessingResult[] = [];
          const postureResults: PostureScoreProcessingResult[] = [];
          let processedCount = 0;
          
          for (let i = 0; i < rawDocsToInsert.length; i++) {
            const rawDoc = rawDocsToInsert[i];
            const rawId = insertedRawIdsAsStrings[i];
            
            try {
              const savedRawDoc = await rawSensorCollection.findOne({ _id: new ObjectId(rawId) });
              if (!savedRawDoc) {
                angleResults.push({ message: `원본 데이터 조회 실패 (ID: ${rawId})` });
                postureResults.push({ message: `원본 데이터 조회 실패 (ID: ${rawId})` });
                continue;
              }
              
              const processedResult = await processSingleSensorData(
                rawDoc, 
                savedRawDoc, 
                angleDataCollection, 
                postureScoreCollection, 
                rawSensorCollection
              );
              
              angleResults.push(processedResult.angleResult);
              postureResults.push(processedResult.postureResult);
              if (processedResult.flagUpdated) {
                processedCount++;
              }
            } catch (error: any) {
              console.error(`배열 처리 중 오류 (인덱스 ${i}):`, error);
              angleResults.push({ message: `처리 중 오류: ${error.message}` });
              postureResults.push({ message: `처리 중 오류: ${error.message}` });
            }
          }
          
          angleDataResponsePart = angleResults;
          postureScoreResponsePart = postureResults;
          
          console.log(`배열 처리 완료: ${processedCount}/${rawDocsToInsert.length}개 데이터 처리됨`);
        }
      }

      // 단일 데이터 처리 함수
      async function processSingleSensorData(
        rawDoc: Omit<RawSensorData, '_id'>, 
        savedRawDoc: RawSensorData, 
        angleCollection: Collection<AngleData>, 
        postureCollection: Collection<PostureScore>, 
        rawCollection: Collection<RawSensorData>
      ): Promise<{
        angleResult: AngleProcessingResult;
        postureResult: PostureScoreProcessingResult;
        flagUpdated: boolean;
      }> {
        let angleResult: AngleProcessingResult;
        let postureResult: PostureScoreProcessingResult;
        let flagUpdated = false;

        try {
          const angles: AngleResult = accelerationToAngle(
            rawDoc.sensor_values.x_accel, 
            rawDoc.sensor_values.y_accel, 
            rawDoc.sensor_values.z_accel
          );
          
          const newAngleData = createAngleData(
            savedRawDoc.number!,
            angles.X, angles.Y, angles.Z,
            angles.X, angles.Y, angles.Z, 
            75, 
            savedRawDoc.timestamp instanceof Date ? savedRawDoc.timestamp : new Date(savedRawDoc.timestamp)
          );
          newAngleData.userId = savedRawDoc.userId;

          const angleInsertResult = await angleCollection.insertOne(newAngleData as AngleData);
          
          if (angleInsertResult.insertedId) {
            const savedAngleDoc = await angleCollection.findOne({ _id: angleInsertResult.insertedId });
            if (savedAngleDoc) {
              angleResult = {
                insertedId: angleInsertResult.insertedId.toHexString(),
                sample: convertAngleDocToApiResponse(savedAngleDoc),
                message: '각도 데이터 저장 성공'
              };
              
              // 자세 점수 생성 및 저장
              try {
                const postureAnalysis = analyzePostureFromAngles(angles);
                const newPostureScore = createPostureScoreFromAnalysis(
                  postureAnalysis,
                  savedRawDoc.number!,
                  savedRawDoc.timestamp instanceof Date ? savedRawDoc.timestamp : new Date(savedRawDoc.timestamp)
                );

                const postureInsertResult = await postureCollection.insertOne(newPostureScore as PostureScore);
                
                if (postureInsertResult.insertedId) {
                  const savedPostureDoc = await postureCollection.findOne({ _id: postureInsertResult.insertedId });
                  if (savedPostureDoc) {
                    postureResult = {
                      insertedId: postureInsertResult.insertedId.toHexString(),
                      sample: convertPostureScoreDocToApiResponse(savedPostureDoc),
                      message: '자세 점수 저장 성공'
                    };
                  } else {
                    postureResult = { message: '자세 점수 저장 후 조회 실패' };
                  }
                } else {
                  postureResult = { message: '자세 점수 저장 실패 (ID 없음)' };
                }
              } catch (postureError: any) {
                console.error('자세 점수 생성 또는 저장 실패:', postureError);
                postureResult = { message: `자세 점수 처리 중 오류: ${postureError.message}` };
              }
              
              // 플래그 업데이트
              await rawCollection.updateOne(
                { _id: savedRawDoc._id }, 
                { $set: { processedToAngle: true, updatedAt: new Date() } }
              );
              flagUpdated = true;
              
            } else {
              angleResult = { message: '각도 데이터 저장 후 조회 실패' };
              postureResult = { message: '각도 데이터 저장 실패로 인한 자세 점수 처리 불가' };
            }
          } else {
            angleResult = { message: '각도 데이터 저장 실패 (ID 없음)' };
            postureResult = { message: '각도 데이터 저장 실패로 인한 자세 점수 처리 불가' };
          }
        } catch (angleError: any) {
          console.error('각도 변환 또는 저장 실패:', angleError);
          angleResult = { message: `각도 처리 중 오류: ${angleError.message}` };
          postureResult = { message: `각도 처리 실패로 인한 자세 점수 처리 불가: ${angleError.message}` };
        }

        return { angleResult, postureResult, flagUpdated };
      }

      // 메시지 생성 (단일/배열 구분)
      let additionalMessage = '';
      if (angleDataResponsePart) {
        if (Array.isArray(angleDataResponsePart)) {
          const successCount = angleDataResponsePart.filter(result => result.sample).length;
          additionalMessage += ` 각도 데이터 ${successCount}/${angleDataResponsePart.length}개 처리 완료.`;
        } else {
          additionalMessage += ` ${angleDataResponsePart.message}`;
        }
      }
      if (postureScoreResponsePart) {
        if (Array.isArray(postureScoreResponsePart)) {
          const successCount = postureScoreResponsePart.filter(result => result.sample).length;
          additionalMessage += ` 자세 점수 ${successCount}/${postureScoreResponsePart.length}개 처리 완료.`;
        } else {
          additionalMessage += ` ${postureScoreResponsePart.message}`;
        }
      }

      res.status(201).json({
        success: true,
        message: `원본 센서 데이터 ${rawSensorDataResponsePart.insertedCount}개 저장 완료.${additionalMessage}`,
        rawSensorDataResult: rawSensorDataResponsePart,
        angleDataResult: angleDataResponsePart,
        postureScoreResult: postureScoreResponsePart,
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