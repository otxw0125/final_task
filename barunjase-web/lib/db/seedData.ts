import { connectToDatabase } from './mongodb';
import { 
  RawSensorDataCollection,
  createRawSensorData 
} from '../models/RawSensorData';
import { 
  AngleDataCollection,
  createAngleData 
} from '../models/AngleData';
import { ensureIndexes } from './collections';

/**
 * 개발 환경에서 테스트용 더미 데이터를 생성합니다.
 */
export async function seedDummyData(): Promise<void> {
  // 개발 환경에서만 실행
  if (process.env.NODE_ENV !== 'development') {
    console.log('Seeding is only available in development environment');
    return;
  }

  const { db } = await connectToDatabase();

  // 기존 데이터 삭제 여부 확인
  const shouldDropCollections = process.env.SEED_DROP_COLLECTIONS === 'true';
  
  if (shouldDropCollections) {
    console.log('Dropping existing collections...');
    try {
      await db.collection(RawSensorDataCollection).drop();
    } catch (error) {
      console.log('Collection does not exist or could not be dropped');
    }
    
    try {
      await db.collection(AngleDataCollection).drop();
    } catch (error) {
      console.log('Collection does not exist or could not be dropped');
    }
  }

  // 인덱스 생성 보장
  await ensureIndexes();

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
    
    rawSensorDataSamples.push(createRawSensorData(i + 1, x, y, z, timestamp));
  }

  // AngleData 더미 데이터 생성
  const angleDataSamples = [];
  
  for (let i = 0; i < 720; i++) {
    const timestamp = new Date(now.getTime() - (720 - i) * 5000);
    
    // 각도 값을 현실적인 범위 내에서 무작위 생성
    // 시간이 지날수록 부적절한 자세를 취하는 패턴 시뮬레이션
    const progression = i / 720; // 0 ~ 1 범위의 진행도
    
    // X축 기울기 (목): 시간이 지날수록 약간 앞으로 숙여짐
    const X = Math.round(-10 + progression * 25 + (Math.random() - 0.5) * 10);
    
    // Y축 기울기 (허리): 시간이 지날수록 약간 굽어짐
    const Y = Math.round(-5 + progression * 15 + (Math.random() - 0.5) * 8);
    
    // Z축 회전: 랜덤한 작은 회전
    const Z = Math.round((Math.random() - 0.5) * 12);
    
    angleDataSamples.push(createAngleData(
      i + 1, // sensorDataNumber
      X,     // xAngle
      Y,     // yAngle
      Z,     // zAngle
      X,     // xFiltered (같은 값으로 시뮬레이션)
      Y,     // yFiltered (같은 값으로 시뮬레이션)
      Z,     // zFiltered (같은 값으로 시뮬레이션)
      75 + Math.round((Math.random() - 0.5) * 30), // 임의의 점수 (60-90 범위)
      timestamp
    ));
  }

  // 데이터베이스에 저장
  if (rawSensorDataSamples.length > 0) {
    await db.collection(RawSensorDataCollection).insertMany(rawSensorDataSamples);
    console.log(`Inserted ${rawSensorDataSamples.length} raw sensor data samples`);
  }
  
  if (angleDataSamples.length > 0) {
    await db.collection(AngleDataCollection).insertMany(angleDataSamples);
    console.log(`Inserted ${angleDataSamples.length} angle data samples`);
  }
  
  console.log('Dummy data seeding completed!');
}

//file scripts/seed-dev-data.ts
