//file scripts/test-env.ts
// 환경 변수가 제대로 로드되는지 테스트하는 간단한 스크립트
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// .env.local 파일 로드 시도
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Checking .env.local file at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('.env.local file exists');
  
  // 파일 내용 확인 (보안 정보 제외)
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n')
    .map(line => {
      // URI나 secret 등의 민감한 정보는 가리기
      if (line.includes('URI=') || line.includes('SECRET=') || line.includes('KEY=')) {
        const parts = line.split('=');
        if (parts.length > 1) {
          return `${parts[0]}=***hidden***`;
        }
      }
      return line;
    });
  
  console.log('.env.local content structure:');
  console.log(lines.join('\n'));
  
  // dotenv로 환경 변수 로드
  config({ path: envPath });
} else {
  console.log('.env.local file does not exist!');
}

console.log('\nEnvironment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_DB_NAME:', process.env.MONGODB_DB_NAME);

// 설정된 환경 변수 목록 (민감한 정보 제외)
console.log('\nAll environment variables:');
const envVars = Object.keys(process.env).sort();
for (const key of envVars) {
  if (key.startsWith('MONGODB_') || key === 'NODE_ENV') {
    if (key.includes('URI') || key.includes('PASSWORD') || key.includes('SECRET')) {
      console.log(`${key}: ***hidden***`);
    } else {
      console.log(`${key}: ${process.env[key]}`);
    }
  }
}