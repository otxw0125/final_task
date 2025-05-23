import { MongoClient, Db } from 'mongodb';

// 환경 변수 확인 및 오류 처리 개선
if (!process.env.MONGODB_URI) {
  console.error('환경 변수가 로드되지 않았습니다. MONGODB_URI가 없습니다.');
  console.error('현재 로드된 환경 변수 확인:', Object.keys(process.env).filter(key => key.startsWith('MONGODB')));
  throw new Error('MONGODB_URI 환경 변수가 .env.local 파일에 설정되어 있는지 확인하세요.');
}

if (!process.env.MONGODB_DB_NAME) {
  console.error('환경 변수가 로드되지 않았습니다. MONGODB_DB_NAME이 없습니다.');
  throw new Error('MONGODB_DB_NAME 환경 변수가 .env.local 파일에 설정되어 있는지 확인하세요.');
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

interface MongoConnection {
  client: MongoClient;
  db: Db;
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * MongoDB에 연결하고 클라이언트와 DB 인스턴스를 반환합니다.
 * 연결은 캐시되어 재사용됩니다.
 */
export async function connectToDatabase(): Promise<MongoConnection> {
  // 캐시된 연결이 있다면 반환
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // 캐시된 연결이 없다면 새로 연결 시도
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);

    // 연결 성공 시 캐시에 저장
    cachedClient = client;
    cachedDb = db;

    console.log('Successfully connected to MongoDB');
    return { client, db };
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * 애플리케이션 종료 시 MongoDB 연결을 정상적으로 종료합니다.
 */
export async function closeMongoDBConnection(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('MongoDB connection closed');
  }
}

// 개발 환경에서 핫 리로딩 시 중복 연결 방지
if (process.env.NODE_ENV === 'development') {
  // @ts-ignore - 전역 객체에 속성 추가
  if (!global._mongoClientPromise) {
    // @ts-ignore
    global._mongoClientPromise = MongoClient.connect(uri);
  }
  // @ts-ignore
  cachedClient = global._mongoClientPromise;
}

// 비정상 종료 시 연결 종료 처리
process.on('SIGINT', async () => {
  await closeMongoDBConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeMongoDBConnection();
  process.exit(0);
});