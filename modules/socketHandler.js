// socketHandler.js

const axios = require('axios'); // axios 라이브러리 import
// 사용자 ID와 소켓 ID를 매핑하기 위한 객체 (메모리 기반 예시)
// 실제 프로덕션에서는 Redis 같은 외부 저장소를 사용하는 것이 더 안정적일 수 있습니다.
const userSocketMap = new Map(); // Map<userId, socketId>

// --- Flask 서비스 연동을 위한 설정 ---
const FLASK_API_URL = 'http://127.0.0.1:5000/predict'; // Flask 서버 주소
const userDataBuffers = new Map(); // Map<userId, SensorData[]> 사용자별 데이터 버퍼
const BUFFER_DURATION_MS = 5000; // 분석할 데이터 시간 범위 (예: 5초)
const MIN_BUFFER_SIZE_FOR_ANALYSIS = 10; // 분석을 위한 최소 데이터 개수 (예: 10개)
// ------------------------------------
// SensorData 타입 정의 (프로젝트에 맞게 조정)
interface SensorData {
  userId: string;
  accel: { x: number; y: number; z: number };
  timestamp: string | Date; // Date 객체 또는 ISO 문자열
}

function initializeSocket(io, db, sessionMiddleware) { // express-session 미들웨어를 전달받음

  // Socket.IO 연결 시 express-session 미들웨어 사용 설정
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
    // 이제 socket.request.session 에서 세션 데이터 접근 가능
  });

  io.on('connection', (socket) => {
    // 1. 사용자 인증 및 소켓 매핑
    const session = socket.request.session;
    if (session && session.user && session.user._id) {
      const userId = session.user._id.toString();
      console.log(`클라이언트 연결: ${socket.id}, 사용자 ID: ${userId}`);

      // 기존 연결이 있으면 제거 (한 사용자가 여러 탭/기기에서 접속하는 경우 마지막 연결만 유효하게 할 경우)
      // 또는 여러 소켓 ID를 배열로 관리할 수도 있음
      const existingSocketId = userSocketMap.get(userId);
      if (existingSocketId && io.sockets.sockets.get(existingSocketId)) {
         console.log(`기존 소켓 연결(${existingSocketId}) 제거 for 사용자 ${userId}`);
         // 필요시 이전 소켓 강제 종료: io.sockets.sockets.get(existingSocketId).disconnect();
      }

      // 사용자 ID와 현재 소켓 ID 매핑
      userSocketMap.set(userId, socket.id);

      // (선택) 연결된 사용자에게 초기 데이터 전송 등
      // socket.emit('initial_data', { message: '연결되었습니다!' });

    } else {
      console.log(`클라이언트 연결 (미인증): ${socket.id}`);
      // 미인증 사용자는 연결 해제 또는 제한된 기능만 제공
      // socket.disconnect();
    }

    // 2. 연결 해제 시 매핑 제거
    socket.on('disconnect', () => {
      // 어떤 사용자가 연결 해제되었는지 찾아서 매핑 제거
      let disconnectedUserId = null;
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          userSocketMap.delete(userId);
          break;
        }
      }
      if (disconnectedUserId) {
        console.log(`클라이언트 연결 해제: ${socket.id}, 사용자 ID: ${disconnectedUserId}`);
      } else {
        console.log(`클라이언트 연결 해제 (미인증): ${socket.id}`);
      }
    });

    // 3. (선택) 클라이언트로부터 오는 다른 이벤트 처리
    // socket.on('request_historical_data', (payload) => { ... });
  });

  // ---- 외부에서 호출할 함수들 ----

  /**
   * 특정 사용자에게 실시간 센서 데이터를 전송합니다.
   * @param {string} userId 데이터를 받을 사용자의 ID
   * @param {object} data 전송할 센서 데이터 (이제 accel 포함)
   */
  function sendDataToUser(userId, data) {
    const socketId = userSocketMap.get(userId);
    if (socketId && io.sockets.sockets.get(socketId)) {
      // 이제 data는 { userId, accel: {x,y,z}, timestamp } 구조
      io.to(socketId).emit('new_posture_data', data);
    } else {
      // console.log(`User ${userId} is not connected or socket ID not found.`);
    }
  }

  /**
   * 특정 사용자에게 자세 경고 알림을 보냅니다. (기존 함수 유지)
   * @param {string} userId 알림을 받을 사용자의 ID
   * @param {object} alertInfo 알림 정보 (예: { level: 'warning', message: '...' })
   */
  function sendAlertToUser(userId, alertInfo) {
    const socketId = userSocketMap.get(userId);
    if (socketId && io.sockets.sockets.get(socketId)) {
      io.to(socketId).emit('posture_alert', alertInfo);
      console.log(`Sent alert to user ${userId} (socket ${socketId}): ${alertInfo.message}`);
    } else {
      // console.log(`User ${userId} is not connected for alert.`);
    }
  }

   /**
   * 자세 데이터를 받아 버퍼링하고, Flask 서비스로 분석 요청을 보냅니다.
   * @param {string} userId
   * @param {SensorData} newSensorData 새로 수신된 센서 데이터 ({ userId, accel: {x,y,z}, timestamp })
   */
   async function analyzeAndAlert(userId, newSensorData) {
    // 1. 사용자별 데이터 버퍼 가져오기 또는 생성
    if (!userDataBuffers.has(userId)) {
      userDataBuffers.set(userId, []);
    }
    const buffer = userDataBuffers.get(userId);

    // 2. 새 데이터 버퍼에 추가
    buffer.push(newSensorData);

    // 3. 오래된 데이터 제거 (버퍼 시간 관리)
    const now = Date.now();
    // timestamp가 Date 객체가 아닐 수 있으므로 new Date()로 변환
    while (buffer.length > 0 && now - new Date(buffer[0].timestamp).getTime() > BUFFER_DURATION_MS) {
      buffer.shift(); // 배열의 맨 앞(가장 오래된) 데이터 제거
    }

    // 4. 분석 가능한 최소 데이터 개수 확인
    if (buffer.length >= MIN_BUFFER_SIZE_FOR_ANALYSIS) {
      try {
        // 5. Flask API로 분석 요청 보내기
        console.log(`[${userId}] Sending ${buffer.length} data points to Flask (${FLASK_API_URL})`);

        // 버퍼 복사본을 보내는 것이 더 안전할 수 있음
        const bufferCopy = [...buffer];
        // 버퍼 비우기 (다음 분석 주기를 위해 - 데이터 중복 분석 방지)
        userDataBuffers.set(userId, []);

        const response = await axios.post(FLASK_API_URL, {
          userId: userId,
          sensorData: bufferCopy // 현재 버퍼 데이터 전송
        });

        // 6. Flask 응답 결과 처리
        if (response.data && response.data.analysis) {
          const analysisResult = response.data.analysis;
          console.log(`[${userId}] Flask Analysis Result: ${analysisResult}`);

          // 7. 분석 결과에 따라 알림 전송
          // Flask 결과 문자열에 '경고!' 또는 '주의'가 포함되어 있는지 확인 (Flask 로직과 일치시켜야 함)
          if (analysisResult.includes("경고!") || analysisResult.includes("주의")) {
             sendAlertToUser(userId, {
                 level: analysisResult.includes("경고!") ? 'warning' : 'info',
                 message: analysisResult // Flask에서 받은 메시지 그대로 전달
             });
          }

          // (선택) Node.js에서 분석 결과를 MongoDB에 저장할 수도 있습니다.
           await db.collection('analysis_results').insertOne({ ...response.data, receivedTimestamp: new Date() });

        } else {
          console.log(`[${userId}] Received unexpected response from Flask:`, response.data);
        }

      } catch (error) {
        // 네트워크 오류, Flask 서버 다운 등의 경우 에러 로깅
        if (axios.isAxiosError(error)) { // Axios 에러인 경우 더 자세한 정보 로깅
             console.error(`[${userId}] Error calling Flask API: ${error.message}`, error.response?.data || '');
        } else {
             console.error(`[${userId}] Error processing Flask analysis:`, error);
        }
        // 실패 시 버퍼를 유지할지 비울지 결정 (재시도 로직 등)
        // 여기서는 일단 비워진 상태 유지 (위에서 buffer 비우는 로직 실행 시)
        // userDataBuffers.set(userId, []); // 에러 시 버퍼 비우기
      }
    } else {
       // console.log(`[${userId}] Buffer size (${buffer.length}) not sufficient for analysis yet.`);
    }
  }

  // 외부에서 사용할 수 있도록 함수들을 반환
  return {
    sendDataToUser,
    sendAlertToUser,
    analyzeAndAlert, // 수정된 함수
  };
}

module.exports = initializeSocket;