// 더미 데이터 시드 스크립트
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 환경 변수 설정
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// MongoDB 연결 정보
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DB || 'barunjase';

if (!MONGODB_URI) {
  console.error('MONGODB_URI가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
  process.exit(1);
}

// 컬렉션 이름
const RAW_SENSOR_DATA_COLLECTION = 'rawsensordata';
const ANGLE_DATA_COLLECTION = 'angledata';

// MongoDB 연결
async function connectToDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return { client, db: client.db(DATABASE_NAME) };
}

// 더미 데이터 생성 함수
async function seedDummyData() {
  console.log('더미 데이터 생성 시작...');
  
  const { client, db } = await connectToDatabase();
  
  try {
    // 기존 컬렉션 삭제
    try {
      await db.collection(RAW_SENSOR_DATA_COLLECTION).drop();
      console.log(`${RAW_SENSOR_DATA_COLLECTION} 컬렉션 삭제 완료`);
    } catch (error) {
      console.log(`${RAW_SENSOR_DATA_COLLECTION} 컬렉션이 없거나 삭제할 수 없습니다.`);
    }
    
    try {
      await db.collection(ANGLE_DATA_COLLECTION).drop();
      console.log(`${ANGLE_DATA_COLLECTION} 컬렉션 삭제 완료`);
    } catch (error) {
      console.log(`${ANGLE_DATA_COLLECTION} 컬렉션이 없거나 삭제할 수 없습니다.`);
    }
    
    // 인덱스 생성
    await db.collection(RAW_SENSOR_DATA_COLLECTION).createIndex({ number: 1 }, { unique: true });
    await db.collection(ANGLE_DATA_COLLECTION).createIndex({ sensorDataNumber: 1 }, { unique: true });
    console.log('인덱스 생성 완료');
    
    // RawSensorData 더미 데이터 생성
    const rawSensorDataSamples = [];
    const now = new Date();
    
    // 지난 1시간 동안의 데이터 샘플 생성 (5초 간격)
    for (let i = 0; i < 720; i++) {
      const timestamp = new Date(now.getTime() - (720 - i) * 5000);
      
      // X, Y, Z 값을 현실적인 범위 내에서 무작위 생성
      const x = -1 + Math.random() * 2; // -1 ~ 1 범위
      const y = -1 + Math.random() * 2; // -1 ~ 1 범위
      const z = 0.5 + Math.random() * 0.5; // 0.5 ~ 1 범위 (중력 가속도)
      
      rawSensorDataSamples.push({
        number: i + 1,
        timestamp,
        accel: { x, y, z },
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    
    // AngleData 더미 데이터 생성
    const angleDataSamples = [];
    
    for (let i = 0; i < 720; i++) {
      const timestamp = new Date(now.getTime() - (720 - i) * 5000);
      
      // 각도 값을 현실적인 범위 내에서 무작위 생성
      // 시간이 지날수록 부적절한 자세를 취하는 패턴 시뮬레이션
      const progression = i / 720; // 0 ~ 1 범위의 진행도
      
      // X축 기울기 (목): 시간이 지날수록 약간 앞으로 숙여짐
      const x = Math.round(-10 + progression * 25 + (Math.random() - 0.5) * 10);
      
      // Y축 기울기 (허리): 시간이 지날수록 약간 굽어짐
      const y = Math.round(-5 + progression * 15 + (Math.random() - 0.5) * 8);
      
      // Z축 회전: 랜덤한 작은 회전
      const z = Math.round((Math.random() - 0.5) * 12);
      
      // 점수에 따른 자세 카테고리 결정
      const score = 75 + Math.round((Math.random() - 0.5) * 30);
      let category;
      if (score >= 80) {
        category = 'good';
      } else if (score >= 60) {
        category = 'moderate';
      } else {
        category = 'poor';
      }
      
      angleDataSamples.push({
        sensorDataNumber: i + 1,
        timestamp,
        angles: {
          x,
          y,
          z
        },
        filtered: {
          x,
          y,
          z
        },
        scoreData: {
          score,
          category,
          continuousDuration: 0
        },
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    
    // 데이터베이스에 저장
    if (rawSensorDataSamples.length > 0) {
      await db.collection(RAW_SENSOR_DATA_COLLECTION).insertMany(rawSensorDataSamples);
      console.log(`${rawSensorDataSamples.length}개의 원시 센서 데이터 샘플 삽입 완료`);
    }
    
    if (angleDataSamples.length > 0) {
      await db.collection(ANGLE_DATA_COLLECTION).insertMany(angleDataSamples);
      console.log(`${angleDataSamples.length}개의 각도 데이터 샘플 삽입 완료`);
    }
    
    console.log('더미 데이터 생성 완료!');
  } finally {
    await client.close();
    console.log('MongoDB 연결 종료');
  }
}

// 실행
seedDummyData()
  .then(() => {
    console.log('스크립트 실행 완료');
    process.exit(0);
  })
  .catch(err => {
    console.error('오류 발생:', err);
    process.exit(1);
  }); 