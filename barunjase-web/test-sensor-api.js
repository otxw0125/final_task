// 센서 데이터 API 테스트 스크립트
// 사용법: node test-sensor-api.js

const testSensorAPI = async () => {
  const baseURL = 'http://localhost:3000';
  
  console.log('🧪 센서 데이터 API 테스트 시작...\n');

  // 1. 단일 센서 데이터 전송 테스트
  console.log('1️⃣ 단일 센서 데이터 POST 테스트');
  try {
    const singleData = {
      x_accel: 1.23,
      y_accel: 4.56,
      z_accel: 7.89,
      timestamp: Date.now()
    };

    const response1 = await fetch(`${baseURL}/api/sensor-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(singleData)
    });

    const result1 = await response1.json();
    console.log('✅ 단일 데이터 전송 성공:', result1);
  } catch (error) {
    console.error('❌ 단일 데이터 전송 실패:', error.message);
  }

  console.log('\n');

  // 2. 배열 센서 데이터 전송 테스트 (안드로이드 앱에서 보내는 형태)
  console.log('2️⃣ 배열 센서 데이터 POST 테스트 (안드로이드 앱 형태)');
  try {
    const arrayData = [
      {
        x_accel: 1.11,
        y_accel: 2.22,
        z_accel: 3.33,
        timestamp: Date.now() - 3000
      },
      {
        x_accel: 1.44,
        y_accel: 2.55,
        z_accel: 3.66,
        timestamp: Date.now() - 2000
      },
      {
        x_accel: 1.77,
        y_accel: 2.88,
        z_accel: 3.99,
        timestamp: Date.now() - 1000
      }
    ];

    const response2 = await fetch(`${baseURL}/api/sensor-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Android-Test-Device'
      },
      body: JSON.stringify(arrayData)
    });

    const result2 = await response2.json();
    console.log('✅ 배열 데이터 전송 성공:', result2);
  } catch (error) {
    console.error('❌ 배열 데이터 전송 실패:', error.message);
  }

  console.log('\n');

  // 3. 데이터 조회 테스트
  console.log('3️⃣ 센서 데이터 GET 테스트');
  try {
    const response3 = await fetch(`${baseURL}/api/sensor-data?limit=5&sort=desc`);
    const result3 = await response3.json();
    console.log('✅ 데이터 조회 성공:');
    console.log(`   - 조회된 데이터 수: ${result3.data?.length || 0}`);
    console.log(`   - 평균 magnitude: ${result3.stats?.avg_magnitude?.toFixed(3) || 'N/A'}`);
    if (result3.data && result3.data.length > 0) {
      console.log('   - 최신 데이터 샘플:', {
        x_accel: result3.data[0].x_accel,
        y_accel: result3.data[0].y_accel,
        z_accel: result3.data[0].z_accel,
        magnitude: result3.data[0].magnitude?.toFixed(3),
        timestamp: new Date(result3.data[0].timestamp).toLocaleString()
      });
    }
  } catch (error) {
    console.error('❌ 데이터 조회 실패:', error.message);
  }

  console.log('\n');

  // 4. 잘못된 데이터 전송 테스트
  console.log('4️⃣ 잘못된 데이터 POST 테스트 (에러 처리 확인)');
  try {
    const invalidData = {
      x_accel: 'invalid',
      // y_accel 누락
      z_accel: 7.89
    };

    const response4 = await fetch(`${baseURL}/api/sensor-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData)
    });

    const result4 = await response4.json();
    if (result4.success) {
      console.log('⚠️ 예상과 다름: 잘못된 데이터가 성공으로 처리됨');
    } else {
      console.log('✅ 에러 처리 정상:', result4.message);
    }
  } catch (error) {
    console.log('✅ 에러 처리 정상:', error.message);
  }

  console.log('\n🎉 API 테스트 완료!');
  console.log('\n📱 안드로이드 앱에서 사용할 URL:');
  console.log(`   POST ${baseURL}/api/sensor-data`);
  console.log('\n📊 데이터 조회 URL:');
  console.log(`   GET ${baseURL}/api/sensor-data?limit=100&sort=desc`);
};

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  testSensorAPI().catch(console.error);
}

export default testSensorAPI; 