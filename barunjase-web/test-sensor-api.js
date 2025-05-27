// 센서 데이터 API 테스트 스크립트
// 사용법: node test-sensor-api.js

const testSensorAPI = async () => {
  const baseURL = 'http://localhost:3000';
  let testUserId = `testUser_${Date.now()}`;
  let lastRawDataNumberForUser;

  console.log('🧪 센서 데이터 API 테스트 시작...');
  console.log(`API Base URL: ${baseURL}`);
  console.log(`Test User ID: ${testUserId}\n`);

  // 1. 단일 센서 데이터 전송 테스트 (각도 변환 포함)
  console.log('1️⃣ 단일 센서 데이터 POST 테스트 (각도 변환 포함)');
  try {
    const singleData = {
      number: 10001,
      userId: testUserId,
      x_accel: 0.1,
      y_accel: 0.2,
      z_accel: 9.8,
      timestamp: Date.now(),
      processedToAngle: false // 서버에서 처리 후 true로 변경될 것임
    };
    console.log('   Request Body (단일):', JSON.stringify(singleData));

    const response1 = await fetch(`${baseURL}/api/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(singleData)
    });

    console.log(`   Response Status (단일): ${response1.status}`);
    const result1 = await response1.json();
    console.log('✅ 단일 데이터 전송 결과:', JSON.stringify(result1, null, 2));

    if (result1.success && result1.rawSensorDataResult?.sample) {
      console.log('   저장된 원본 데이터 샘플 (단일):', result1.rawSensorDataResult.sample);
      lastRawDataNumberForUser = result1.rawSensorDataResult.sample.number;
      if (result1.rawSensorDataResult.sample.processedToAngle !== true) {
        console.warn('   ⚠️ 경고: 단일 전송 시 processedToAngle이 true여야 합니다.');
      }
    }
    if (result1.success && result1.angleDataResult?.sample) {
      console.log('   저장된 각도 데이터 샘플 (단일):', result1.angleDataResult.sample);
      if (result1.angleDataResult.sample.sensorDataNumber !== lastRawDataNumberForUser) {
        console.warn('   ⚠️ 경고: 각도 데이터의 sensorDataNumber가 원본 데이터 number와 일치하지 않습니다.');
      }
    } else if (result1.success && result1.angleDataResult?.message && !result1.angleDataResult?.sample) {
      console.warn('   ⚠️ 각도 데이터 처리 메시지:', result1.angleDataResult.message);
    }
    
    if (result1.success && result1.postureScoreResult?.sample) {
      console.log('   저장된 자세 점수 샘플 (단일):', result1.postureScoreResult.sample);
      if (result1.postureScoreResult.sample.number !== lastRawDataNumberForUser) {
        console.warn('   ⚠️ 경고: 자세 점수의 number가 원본 데이터 number와 일치하지 않습니다.');
      }
      console.log(`   자세 점수: ${result1.postureScoreResult.sample.score}점, 피드백: ${result1.postureScoreResult.sample.feedback}`);
    } else if (result1.success && result1.postureScoreResult?.message && !result1.postureScoreResult?.sample) {
      console.warn('   ⚠️ 자세 점수 처리 메시지:', result1.postureScoreResult.message);
    }

  } catch (error) {
    console.error('❌ 단일 데이터 전송 실패:', error);
  }

  console.log('\n');

  // 2. 배열 센서 데이터 전송 테스트 (각도 변환 및 자세 점수 생성 포함)
  console.log('2️⃣ 배열 센서 데이터 POST 테스트 (각도 변환 및 자세 점수 생성 포함)');
  try {
    const arrayData = [
      {
        number: 20001,
        userId: testUserId,
        x_accel: -0.5,
        y_accel: 1.0,
        z_accel: 9.5,
        timestamp: Date.now() - 3000
      },
      {
        number: 20002,
        userId: testUserId,
        x_accel: 0.0,
        y_accel: -0.1,
        z_accel: 9.81,
        timestamp: Date.now() - 2000
      }
    ];
    console.log('   Request Body (배열):', JSON.stringify(arrayData));

    const response2 = await fetch(`${baseURL}/api/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arrayData)
    });
    
    console.log(`   Response Status (배열): ${response2.status}`);
    const result2 = await response2.json();
    console.log('✅ 배열 데이터 전송 결과:', JSON.stringify(result2, null, 2));
    if (result2.success && result2.rawSensorDataResult?.sample) {
      console.log('   저장된 원본 데이터 첫번째 샘플 (배열):', result2.rawSensorDataResult.sample);
      
      // 배열 전송 시 각도 변환 및 자세 점수 생성 확인
      if (result2.angleDataResult && Array.isArray(result2.angleDataResult)) {
        console.log(`   각도 데이터 처리 결과 (배열): ${result2.angleDataResult.length}개`);
        result2.angleDataResult.forEach((angleResult, index) => {
          if (angleResult.sample) {
            console.log(`     [${index}] 각도 데이터 저장 성공: ${angleResult.sample.sensorDataNumber}`);
          } else {
            console.log(`     [${index}] 각도 데이터 처리 실패: ${angleResult.message}`);
          }
        });
      }
      
      if (result2.postureScoreResult && Array.isArray(result2.postureScoreResult)) {
        console.log(`   자세 점수 처리 결과 (배열): ${result2.postureScoreResult.length}개`);
        result2.postureScoreResult.forEach((postureResult, index) => {
          if (postureResult.sample) {
            console.log(`     [${index}] 자세 점수 저장 성공: ${postureResult.sample.number}번, 점수: ${postureResult.sample.score}점`);
          } else {
            console.log(`     [${index}] 자세 점수 처리 실패: ${postureResult.message}`);
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ 배열 데이터 전송 실패:', error);
  }

  console.log('\n');

  // 3. 특정 사용자 데이터 조회 테스트 (GET by userId)
  console.log(`3️⃣ 특정 사용자 (${testUserId}) 데이터 GET 테스트`);
  try {
    const getURLUser = `${baseURL}/api/sensor-data?userId=${testUserId}&limit=5&sort=desc`;
    console.log(`   Request URL (GET by userId): ${getURLUser}`);
    const responseUser = await fetch(getURLUser);
    console.log(`   Response Status (GET by userId): ${responseUser.status}`);
    const resultUser = await responseUser.json();
    console.log('✅ 특정 사용자 데이터 조회 결과:', JSON.stringify(resultUser, null, 2));
    if (resultUser.success && resultUser.data) {
        console.log(`   - 조회된 ${testUserId}의 데이터 수: ${resultUser.data.length}`);
        resultUser.data.forEach(item => {
            if (item.userId !== testUserId) {
                console.error(`   ❌ 오류: 조회된 데이터의 userId(${item.userId})가 요청한 userId(${testUserId})와 다릅니다.`);
            }
        });
        if (resultUser.data.length === 0) {
            console.warn(`   ⚠️ ${testUserId} 사용자의 데이터가 없습니다. POST 테스트가 정상적으로 실행되었는지 확인하세요.`);
        }
    }
    if (resultUser.latest_sample && resultUser.latest_sample.userId !== testUserId) {
         console.error(`   ❌ 오류: latest_sample의 userId(${resultUser.latest_sample.userId})가 요청한 userId(${testUserId})와 다릅니다.`);
    }

  } catch (error) {
    console.error('❌ 특정 사용자 데이터 조회 실패:', error);
  }
  console.log('\n');

  // 4. 전체 데이터 조회 테스트 (GET all)
  console.log('4️⃣ 전체 데이터 GET 테스트 (최신 5개)');
  try {
    const getURLAll = `${baseURL}/api/sensor-data?limit=5&sort=desc`;
    console.log(`   Request URL (GET all): ${getURLAll}`);
    const responseAll = await fetch(getURLAll);
    console.log(`   Response Status (GET all): ${responseAll.status}`);
    const resultAll = await responseAll.json();
    // console.log('✅ 전체 데이터 조회 결과:', JSON.stringify(resultAll, null, 2)); // 너무 길어서 주석 처리
    console.log('✅ 전체 데이터 조회 성공 (일부 결과만 표시):');
    console.log(`   - 조회된 전체 데이터 수 (최대 5개): ${resultAll.data?.length || 0}`);
    if (resultAll.latest_sample) {
      console.log('   - 최신 데이터 샘플 (전체):', {
        _id: resultAll.latest_sample._id,
        number: resultAll.latest_sample.number,
        userId: resultAll.latest_sample.userId,
        sensor_values: resultAll.latest_sample.sensor_values,
        timestamp: resultAll.latest_sample.timestamp,
        processedToAngle: resultAll.latest_sample.processedToAngle
      });
    }
  } catch (error) {
    console.error('❌ 전체 데이터 조회 실패:', error);
  }

  console.log('\n');

  // 5. 잘못된 데이터 전송 테스트 (필수 필드 누락)
  console.log('5️⃣ 잘못된 데이터 POST 테스트 (필수 필드 누락)');
  try {
    const invalidData = { number: 30001, y_accel: 5.67, z_accel: 8.90 }; // x_accel 누락
    console.log('   Request Body (잘못된 데이터):', JSON.stringify(invalidData));
    const responseInvalid = await fetch(`${baseURL}/api/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });
    console.log(`   Response Status (잘못된 데이터): ${responseInvalid.status}`);
    const resultInvalid = await responseInvalid.json();
    if (resultInvalid.success) {
      console.error('❌ 예상과 다름: 잘못된 데이터가 성공으로 처리됨', resultInvalid);
    } else {
      console.log('✅ 에러 처리 정상 (필수 필드 누락):', resultInvalid.message);
      if (resultInvalid.error !== 'Bad Request: Missing x_accel') { 
        console.warn('   ⚠️ 에러 상세 메시지(error 필드)가 예상과 다릅니다:', resultInvalid.error);
      }
      if (responseInvalid.status !== 400) {
        console.warn('   ⚠️ 응답 상태 코드가 400이 아닙니다:', responseInvalid.status);
      }
    }
  } catch (error) {
    console.error('❌ 잘못된 데이터 테스트 중 예외 발생:', error);
  }
  
  console.log('\n🎉 API 테스트 완료 (lib 모듈 통합 및 각도 변환 포함)!');
  console.log('\n📱 안드로이드 앱에서 사용할 URL (POST):', `${baseURL}/api/sensor-data`);
  console.log('📊 특정 사용자 데이터 조회 URL (GET):', `${baseURL}/api/sensor-data?userId=사용자ID`);
  console.log('📊 전체 데이터 조회 URL (GET):', `${baseURL}/api/sensor-data?limit=10&sort=desc`);

  // 6. 보류 중인 각도 및 자세 점수 데이터 일괄 처리 테스트
  console.log('\n6️⃣ 보류 중인 각도 및 자세 점수 데이터 일괄 처리 POST 테스트 (/api/process-pending-angles)');
  let pendingDataForProcessing = [];
  const FLAG_FIELD_NAME_IN_TEST = 'processedToAngle'; // API에서 사용하는 플래그명과 일치시킬 것

  try {
    // 6.1. processedToAngle: false (또는 존재X) 상태의 테스트 데이터 생성
    console.log('   6.1. 일괄 처리를 위한 테스트 RawSensorData 생성 중...');
    const baseNumberForBatch = 40000 + Math.floor(Math.random() * 1000);
    const rawDataForBatchProcessing = [
      {
        number: baseNumberForBatch + 1,
        userId: testUserId,
        x_accel: 0.1, y_accel: 0.2, z_accel: 9.8,
        timestamp: Date.now() - 5000
        // processedToAngle는 의도적으로 생략 (API가 false 또는 없는 것으로 처리해야 함)
      },
      {
        number: baseNumberForBatch + 2,
        userId: testUserId,
        x_accel: -20, y_accel: 1, z_accel: 9.0,
        timestamp: Date.now() - 4000
      },
      {
        number: baseNumberForBatch + 3,
        userId: testUserId,
        x_accel: 0, y_accel: 15, z_accel: 9.8,
        timestamp: Date.now() - 3000,
        [FLAG_FIELD_NAME_IN_TEST]: false // 명시적으로 false로 설정
      }
    ];
    pendingDataForProcessing = rawDataForBatchProcessing.map(d => ({ number: d.number, userId: d.userId, initialFlag: d[FLAG_FIELD_NAME_IN_TEST] }));
    console.log('      Request Body (배열 raw 데이터 생성 raw):', JSON.stringify(rawDataForBatchProcessing));

    const createResponse = await fetch(`${baseURL}/api/sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawDataForBatchProcessing)
    });
    const createResult = await createResponse.json();
    if (!createResult.success || 
        createResponse.status !== 201 || 
        !createResult.rawSensorDataResult || 
        createResult.rawSensorDataResult.insertedCount !== rawDataForBatchProcessing.length || 
        !createResult.rawSensorDataResult.sample 
    ) {
      throw new Error(`테스트 데이터 생성 실패: ${createResult.message || '응답 구조 또는 데이터 삽입 개수 불일치'}. 응답: ${JSON.stringify(createResult)}`);
    }
    console.log(`      ✅ 테스트용 Raw 데이터 ${rawDataForBatchProcessing.length}건 생성 성공. Numbers: ${pendingDataForProcessing.map(p=>p.number).join(', ')}`);

    // 6.2. 일괄 처리 API 호출
    console.log('\n   6.2. /api/process-pending-angles 호출 중...');
    const processResponse = await fetch(`${baseURL}/api/process-pending-angles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`      Response Status (일괄 처리): ${processResponse.status}`);
    const processResult = await processResponse.json();
    console.log('      ✅ 일괄 처리 API 결과:', JSON.stringify(processResult, null, 2));

    if (!processResult.success || !processResult.summary) {
      throw new Error(`일괄 처리 API 실패: ${processResult.message}`);
    }
    if (processResult.summary.errors.length > 0) {
      console.error('      ❌ 일괄 처리 중 오류 발생:', processResult.summary.errors);
      // 오류가 있더라도 부분 성공은 검증할 수 있으므로 테스트를 중단하지는 않음
    }
    
    // 생성한 테스트 데이터 수만큼 처리되었는지 확인 (더 많은 데이터가 처리될 수 있음을 감안)
    if ((processResult.summary.successfullyProcessedRawData + processResult.summary.flagUpdateOnlyForExistingAngleOrScore) < pendingDataForProcessing.length) {
        console.warn(`      ⚠️ 처리된 데이터 수(${processResult.summary.successfullyProcessedRawData + processResult.summary.flagUpdateOnlyForExistingAngleOrScore})가 생성한 테스트 데이터 수(${pendingDataForProcessing.length})보다 적습니다. 다른 데이터와 겹치거나 문제가 있을 수 있습니다.`);
    }
    if (processResult.summary.angleDataCreated < pendingDataForProcessing.filter(d => d.initialFlag !== true).length && processResult.summary.flagUpdateOnlyForExistingAngleOrScore === 0){
        console.warn(`      ⚠️ AngleData 생성 수(${processResult.summary.angleDataCreated})가 예상보다 적습니다.`);
    }
    if (processResult.summary.postureScoresCreated < pendingDataForProcessing.filter(d => d.initialFlag !== true).length && processResult.summary.flagUpdateOnlyForExistingAngleOrScore === 0){
        console.warn(`      ⚠️ PostureScore 생성 수(${processResult.summary.postureScoresCreated})가 예상보다 적습니다.`);
    }

    // 6.3. 처리된 데이터의 플래그, AngleData, PostureScore 생성 확인
    console.log('\n   6.3. 처리된 데이터 상세 확인 중...');
    for (const item of pendingDataForProcessing) {
      console.log(`      - 확인 대상 RawSensorData Number: ${item.number}, UserId: ${item.userId}`);
      // RawSensorData 확인
      const getRawResponse = await fetch(`${baseURL}/api/sensor-data?userId=${item.userId}&limit=50`); // 해당 유저의 최근 50개 데이터 가져오기
      const rawDataResult = await getRawResponse.json();
      if (rawDataResult.success && rawDataResult.data && rawDataResult.data.length > 0) {
        const targetRawData = rawDataResult.data.find(d => d.number === item.number);
        if (targetRawData) {
          if (targetRawData[FLAG_FIELD_NAME_IN_TEST] === true) {
            console.log(`        ✅ RawSensorData Number ${item.number}: ${FLAG_FIELD_NAME_IN_TEST} 플래그 true.`);
          } else {
            console.error(`        ❌ RawSensorData Number ${item.number}: ${FLAG_FIELD_NAME_IN_TEST} 플래그가 true가 아님 (${targetRawData[FLAG_FIELD_NAME_IN_TEST]}).`);
          }

          // AngleData 확인 (API가 없으므로 RawSensorData에 포함된 정보나, 별도 GET 엔드포인트 필요 시 추가)
          // 현재 AngleData를 직접 GET하는 API는 없으므로, 생성 로그나 DB 직접 확인 필요.
          // 여기서는 PostureScore 존재 여부로 간접 확인 또는 summary 카운트 의존
          console.log(`        ℹ️  AngleData for ${item.number}: 생성 여부는 API summary.angleDataCreated 또는 DB 확인.`);

          // PostureScore 확인 (이것도 API 없으므로 간접 확인)
          // 예시: 특정 userId의 PostureScore 목록을 가져오는 API가 있다면...
          // const getPostureScoresResponse = await fetch(`${baseURL}/api/posture-scores?userId=${item.userId}&sensorDataNumber=${item.number}`);
          // const scoresResult = await getPostureScoresResponse.json();
          // if (scoresResult.success && scoresResult.data && scoresResult.data.length > 0) {
          //   const targetScore = scoresResult.data.find(s => s.number === item.number);
          //   if (targetScore) {
          //     console.log(`        ✅ PostureScore Number ${item.number}: 발견됨. Score: ${targetScore.score}, Risk: ${targetScore.riskLevel}`);
          //     if (typeof targetScore.score !== 'number' || !targetScore.riskLevel) {
          //        console.error(`        ❌ PostureScore Number ${item.number}: 점수 또는 위험도 필드 유효하지 않음.`);
          //     }
          //   } else {
          //     console.error(`        ❌ PostureScore Number ${item.number}: 해당 sensorDataNumber로 조회되지 않음.`); 
          //   }
          // } else {
          //   console.error(`        ❌ PostureScore Number ${item.number}: 조회 실패 또는 데이터 없음. ${scoresResult.message || ''}`);
          // }
          console.log(`        ℹ️  PostureScore for ${item.number}: 생성 여부는 API summary.postureScoresCreated 또는 DB 확인.`);

        } else {
          console.error(`        ❌ RawSensorData Number ${item.number} (UserId: ${item.userId}): GET /api/sensor-data 로 조회되지 않음.`);
        }
      } else {
        console.error(`        ❌ RawSensorData Number ${item.number} (UserId: ${item.userId}): GET /api/sensor-data 조회 실패 또는 데이터 없음. ${rawDataResult.message || ''}`);
      }
      console.log(''); // 각 항목 사이에 공백
    }
    
  } catch (error) {
    console.error('❌ 일괄 각도 및 자세 점수 처리 테스트 실패:', error);
  } finally {
    // 정리 코드 (예: 테스트 사용자 데이터 삭제)는 필요시 추가
  }

  console.log('\n🎉 전체 API 테스트 완료 (PostureScore 생성 포함)!');
  console.log('\n📱 안드로이드 앱에서 사용할 URL (POST):', `${baseURL}/api/sensor-data`);
  console.log('🔄 보류된 데이터 일괄 처리 URL (POST):', `${baseURL}/api/process-pending-angles`);
  console.log('📊 특정 사용자 데이터 조회 URL (GET):', `${baseURL}/api/sensor-data?userId=사용자ID`);
  console.log('📊 전체 데이터 조회 URL (GET):', `${baseURL}/api/sensor-data?limit=10&sort=desc`);
};

// 스크립트 실행
(async () => {
  try {
    await testSensorAPI();
  } catch (error) {
    console.error("테스트 스크립트 실행 중 최상위 오류:", error);
  } finally {
    console.log("테스트 스크립트 실행 종료.");
  }
})();

// export default testSensorAPI; // CLI 실행 시에는 이 줄을 주석 처리하거나 삭제합니다. 