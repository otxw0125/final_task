import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
config({ path: '.env.local' });        // 우선 .env.local
config(); 

// ESM에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드
const projectRoot = path.resolve(__dirname, '..');
config({ path: path.join(projectRoot, '.env.local') });
config({ path: path.join(projectRoot, '.env') });

// 환경 변수 확인
console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '(loaded)' : '(not found)');
console.log('MONGODB_DB_NAME:', process.env.MONGODB_DB_NAME);

// seedDummyData 함수는 이후에 가져오기
import { seedDummyData } from '../lib/db/seedData.js';

async function main() {
  try {
    console.log('Starting to seed development data...');
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing. Please check your .env.local file');
    }
    await seedDummyData();
    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding development data:', error);
    process.exit(1);
  }
}

main();