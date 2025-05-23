import { connectToDatabase } from './mongodb';
import { Collection } from 'mongodb';
import { 
  RawSensorData, 
  RawSensorDataCollection 
} from '../models/RawSensorData';
import { 
  AngleData, 
  AngleDataCollection 
} from '../models/AngleData';
import {
  PostureScore,
  PostureScoreCollection
} from '../models/PostureScore';

/**
 * RawSensorData 컬렉션을 가져옵니다.
 */
export async function getRawSensorDataCollection(): Promise<Collection<RawSensorData>> {
  const { db } = await connectToDatabase();
  return db.collection<RawSensorData>(RawSensorDataCollection);
}

/**
 * AngleData 컬렉션을 가져옵니다.
 */
export async function getAngleDataCollection(): Promise<Collection<AngleData>> {
  const { db } = await connectToDatabase();
  return db.collection<AngleData>(AngleDataCollection);
}

/**
 * PostureScore 컬렉션을 가져옵니다.
 */
export async function getPostureScoreCollection(): Promise<Collection<PostureScore>> {
  const { db } = await connectToDatabase();
  return db.collection<PostureScore>(PostureScoreCollection);
}

/**
 * 각 컬렉션에 필요한 인덱스를 생성합니다.
 * 서버 시작 시 한 번만 실행되어야 합니다.
 */
export async function ensureIndexes(): Promise<void> {
  try {
    console.log('Starting to create database indexes...');
    const rawSensorCollection = await getRawSensorDataCollection();
    const angleDataCollection = await getAngleDataCollection();
    const postureScoreCollection = await getPostureScoreCollection();

    // RawSensorData 인덱스
    console.log('Creating RawSensorData indexes...');
    await rawSensorCollection.createIndex({ number: 1 }, { unique: true });
    await rawSensorCollection.createIndex({ timestamp: -1 });

    // AngleData 인덱스
    console.log('Creating AngleData indexes...');
    try {
      // 기존 인덱스 삭제 (중복 키 오류 방지)
      await angleDataCollection.dropIndex('sensorDataNumber_1');
    } catch (error) {
      console.log('No existing sensorDataNumber index to drop, creating new one');
    }
    
    // 새 인덱스 생성
    await angleDataCollection.createIndex({ sensorDataNumber: 1 }, { 
      unique: true,
      sparse: true // null 값은 인덱스에서 제외
    });
    await angleDataCollection.createIndex({ timestamp: -1 });
    await angleDataCollection.createIndex({ 'scoreData.score': -1 });
    await angleDataCollection.createIndex({ 'scoreData.category': 1 });

    // PostureScore 인덱스
    console.log('Creating PostureScore indexes...');
    await postureScoreCollection.createIndex({ number: 1 }, { unique: true });
    await postureScoreCollection.createIndex({ timestamp: -1 });
    await postureScoreCollection.createIndex({ score: -1 });

    console.log('All database indexes have been created successfully');
  } catch (error) {
    console.error('Error creating database indexes:', error);
    throw error;
  }
}