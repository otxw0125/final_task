import { MongoClient } from 'mongodb';

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://admin:Dlghwns8391@sleepy.1jou6.mongodb.net/?retryWrites=true&w=majority";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "barunjase";

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    useUnifiedTopology: true,
  });

  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('rawsensordata');

      // 요청 본문이 배열인지 단일 객체인지 확인
      const sensorDataArray = Array.isArray(req.body) ? req.body : [req.body];
      
      // 각 센서 데이터 처리
      const processedData = sensorDataArray.map(data => {
        // 데이터 유효성 검사
        if (!data.x_accel && data.x_accel !== 0) {
          throw new Error('x_accel 값이 필요합니다');
        }
        if (!data.y_accel && data.y_accel !== 0) {
          throw new Error('y_accel 값이 필요합니다');
        }
        if (!data.z_accel && data.z_accel !== 0) {
          throw new Error('z_accel 값이 필요합니다');
        }

        return {
          x_accel: parseFloat(data.x_accel),
          y_accel: parseFloat(data.y_accel),
          z_accel: parseFloat(data.z_accel),
          timestamp: data.timestamp || Date.now(),
          device_id: data.device_id || req.headers['user-agent'] || 'android_device_001',
          created_at: new Date(),
          // 추가 메타데이터
          magnitude: Math.sqrt(
            Math.pow(parseFloat(data.x_accel), 2) + 
            Math.pow(parseFloat(data.y_accel), 2) + 
            Math.pow(parseFloat(data.z_accel), 2)
          ),
          source: 'android_app'
        };
      });

      // MongoDB에 데이터 삽입
      let result;
      if (processedData.length === 1) {
        result = await collection.insertOne(processedData[0]);
      } else {
        result = await collection.insertMany(processedData);
      }

      console.log(`센서 데이터 저장 완료: ${processedData.length}개 항목`);
      console.log('저장된 데이터 샘플:', processedData[0]);

      // 성공 응답
      res.status(201).json({
        success: true,
        message: `센서 데이터 ${processedData.length}개 저장 성공`,
        insertedCount: processedData.length,
        insertedId: result.insertedId || result.insertedIds,
        data: {
          count: processedData.length,
          timestamp: new Date().toISOString(),
          sample: processedData[0] // 첫 번째 데이터 샘플
        }
      });

    } catch (error) {
      console.error('센서 데이터 저장 실패:', error);
      
      res.status(500).json({
        success: false,
        message: '센서 데이터 저장 실패',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  } 
  
  else if (req.method === 'GET') {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('rawsensordata');

      // 쿼리 파라미터 처리
      const { 
        limit = 100, 
        device_id, 
        start_time, 
        end_time,
        sort = 'desc' 
      } = req.query;

      // 필터 구성
      const filter = {};
      if (device_id) {
        filter.device_id = device_id;
      }
      if (start_time || end_time) {
        filter.timestamp = {};
        if (start_time) filter.timestamp.$gte = parseInt(start_time);
        if (end_time) filter.timestamp.$lte = parseInt(end_time);
      }

      // 정렬 설정
      const sortOption = sort === 'asc' ? { timestamp: 1 } : { timestamp: -1 };

      // 데이터 조회
      const data = await collection
        .find(filter)
        .sort(sortOption)
        .limit(parseInt(limit))
        .toArray();

      // 통계 정보 계산
      const stats = {
        total_count: data.length,
        avg_magnitude: data.length > 0 ? 
          data.reduce((sum, item) => sum + (item.magnitude || 0), 0) / data.length : 0,
        time_range: data.length > 0 ? {
          start: Math.min(...data.map(item => item.timestamp)),
          end: Math.max(...data.map(item => item.timestamp))
        } : null
      };

      res.status(200).json({
        success: true,
        data: data,
        stats: stats,
        query: {
          filter,
          limit: parseInt(limit),
          sort: sortOption
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('데이터 조회 실패:', error);
      
      res.status(500).json({
        success: false,
        message: '데이터 조회 실패',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  else {
    // 지원하지 않는 HTTP 메서드
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
      allowed_methods: ['GET', 'POST', 'OPTIONS']
    });
  }
} 