require('dotenv').config(); // 환경변수 설정
const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http'); // http 모듈 추가
const socketIo = require('socket.io'); // socket.io 모듈 추가
const { getSensorDataByUser } = require('./models/sensorDataModel');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let currentLoggedInUserId = null; // 기본값 또는 null

// session 설정
app.use(session({
    secret: 'yourSecretKey',  
    resave: false,
    saveUninitialized: false
}));

// MongoDB 연결 정보
const uri = process.env.MONGODB_URI; // MongoDB URI를 환경변수에서 불러옴
const dbName = 'ProjectDB';
let db;

// MongoDB 연결
MongoClient.connect(uri)
  .then(client => {
    console.log('MongoDB에 연결되었습니다.');
    db = client.db(dbName);
    
    // 서버 실행
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
    });
  })
  .catch(error => console.error('MongoDB 연결 오류:', error));

// 전역 변수: 최근 각도 값을 모니터링하기 위한 배열 (최대 10개)
let latestAngleValues = [];

// 예시: sensorData를 DB에 삽입하는 함수 (콜백 방식)
function insertTestSensorData() {
  const sensorData = generateRandomSensorData();
  db.collection('sensorData').insertMany(sensorData, (err, result) => {
    if (err) {
      console.error("데이터 삽입 중 오류:", err);
      return;
    }
    console.log(`Test sensor data inserted: ${result.insertedCount}개`);
    // 새로운 데이터가 삽입되면 클라이언트로 전송
    io.emit('newData', sensorData);
  });
}

// 클라이언트 연결 시 이벤트 처리
io.on('connection', (socket) => {
  console.log('클라이언트가 연결되었습니다.');
});

// EJS 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// JSON, URL-encoded 요청 파싱 미들웨어 (중복 제거)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

  try {
    const tiltValue = parseFloat(data);

    if (!isNaN(tiltValue)) {
      // MongoDB에 저장할 데이터 객체 생성
      const sensorRecord = {
        // --- 전역 변수에 저장된 사용자 ID 사용 ---
        // ObjectId로 저장하고 싶다면 new ObjectId(currentLoggedInUserId) 사용 가능
        // 단, currentLoggedInUserId가 유효한 ObjectId 문자열이어야 함
        userId: currentLoggedInUserId,
        tilt: { x: tiltValue, y: 0, z: 0 },
        timestamp: new Date()
      };

      // db 연결 확인
      if (!db) {
        console.error('DB not connected, cannot save sensor data.');
        return; // DB 없으면 저장 시도 중단
      }

      // MongoDB의 sensorData 컬렉션에 데이터 저장
      const insertResult = await db.collection('sensorData').insertOne(sensorRecord);
      console.log(`데이터 저장 완료 (사용자: ${currentLoggedInUserId}): ${insertResult.insertedId}`);

      // 최신 각도 배열 업데이트 (모니터링용)
      latestAngleValues.push(tiltValue);
      if (latestAngleValues.length > 300) {
        latestAngleValues.shift();
      }

      // 실시간 데이터 전송 (Socket.IO)
      io.emit('newData', sensorRecord);

    } else {
      console.warn(`수신된 데이터가 유효한 숫자가 아닙니다: ${data}`);
    }
  } catch (error) {
    // ObjectId 변환 오류 등 처리
    if (error.message.includes('Argument passed in must be a single String')) {
        console.error(`잘못된 사용자 ID 형식(${currentLoggedInUserId})으로 인해 데이터 저장 실패:`, error);
    } else {
        console.error('시리얼 데이터 처리 또는 DB 저장 중 오류:', error);
    }
  }
});

// 기본 홈페이지: 로그인 상태에 따라 서로 다른 페이지 렌더링
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.render('dashboard', { user: req.session.user });
  } else {
    res.render('index');
  }
});

// 로그인 페이지: 로그인 폼 제공
app.get('/login', (req, res) => {
  res.render('login');
});

// --- 2. 로그인 라우트 수정 ---
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
      // db 연결 확인
      if (!db) {
          console.error('DB not connected during login attempt.');
          return res.status(500).send('서버 오류: 데이터베이스 연결 안됨');
      }
      const user = await db.collection('users').findOne({ username: username });
      if (user && user.password === password) { // 비밀번호 해싱 사용 권장
          req.session.user = user;
          // --- 로그인 성공 시 전역 변수에 사용자 ID 저장 ---
          currentLoggedInUserId = user._id.toString(); // ObjectId를 문자열로 변환
          console.log(`로그인 성공: Arduino 데이터는 사용자 ID ${currentLoggedInUserId} 로 저장됩니다.`);
          res.redirect('/');
      } else {
          res.status(401).send('인증 실패: 잘못된 사용자 ID 또는 비밀번호.');
      }
  } catch (error) {
      console.error('로그인 처리 중 오류:', error);
      res.status(500).send('로그인 처리 중 오류 발생');
  }
});

// --- 3. 로그아웃 라우트 추가 (권장) ---
app.get('/logout', (req, res) => {
  if (req.session.user) {
    const loggedOutUserId = req.session.user._id.toString();
    req.session.destroy(err => {
      if (err) {
        console.error('로그아웃 중 세션 파괴 오류:', err);
        return res.status(500).send('로그아웃 실패');
      }
      // 현재 전역 ID가 로그아웃하는 사용자의 ID와 같으면 초기화
      if (currentLoggedInUserId === loggedOutUserId) {
        currentLoggedInUserId = 'arduino_device'; // 기본값으로 리셋
        console.log(`로그아웃: Arduino 데이터 사용자 ID가 기본값(${currentLoggedInUserId})으로 재설정되었습니다.`);
      }
      res.redirect('/login'); // 로그인 페이지로 리디렉션
    });
  } else {
    res.redirect('/login');
  }
});

// 회원가입 페이지
app.get('/signup', (req, res) => {
  res.render('signup');
});

// 회원가입 POST 라우트
app.post('/signup', async (req, res) => {
  const { username, email, password, uniqueKey } = req.body;
  const userData = {
    username,
    email,
    password,
    uniqueKey: uniqueKey || ""
  };

  try {
    await db.collection('users').insertOne(userData);
    res.render('signup_success');
  } catch (error) {
    console.error(error);
    res.status(500).send('회원가입 처리 중 오류 발생');
  }
});

// 모니터링 페이지 라우트 (최신 각도 값 배열 전달)
app.get('/monitoring', (req, res) => {
  res.render('monitoring', { latestAngleValues });
});

// 센서 데이터 수신용 POST 라우트 (아두이노 또는 클라이언트에서 각도 데이터 전송)
app.post('/api/sensorData', async (req, res) => {
  const { adjusted_angle } = req.body; // 아두이노에서 보낸 데이터 (adjusted_angle)
  
  latestAngleValues.push(adjusted_angle);
  if (latestAngleValues.length > 300) {
    latestAngleValues.shift();
  }

  try {
    console.log('받은 각도 값:', adjusted_angle);
    res.status(200).send('데이터가 성공적으로 저장되었습니다.');
  } catch (error) {
    console.error(error);
    res.status(500).send('데이터 저장 중 오류 발생');
  }
});

// 최신 센서 데이터 요청용 GET 라우트
app.get('/api/latestSensorData', (req, res) => {
  if (latestAngleValues.length > 0) {
      res.json({ random_values: latestAngleValues });
  } else {
      res.status(404).send('각도 값이 없습니다.');
  }
});

// 분석 페이지: 로그인한 사용자의 센서 데이터 조회 후 전달
app.get('/analyze', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const sensorData = await getSensorDataByUser(db, req.session.user._id);
    res.render('analyze', { sensorData });
  } catch (error) {
    console.error(error);
    res.status(500).send('센서 데이터 조회 중 오류 발생');
  }
});

// API 엔드포인트: 센서 데이터를 { userId, tilt, timestamp } 형식으로 반환
// app.js의 /api/sensor-data 라우트 수정 예시
app.get('/api/sensor-data', async (req, res) => {
  try {
    // 쿼리 파라미터에서 limit 값을 가져오고, 없으면 기본값 100 설정
    const limit = parseInt(req.query.limit) || 100;

    const sensorData = await db.collection('sensorData')
      .find({})
      .sort({ timestamp: -1 }) // 최신 데이터부터 가져옴
      .limit(limit) // 요청된 개수만큼 제한
      .toArray();

    // 클라이언트에서는 시간순 정렬이 필요하므로, 여기서 다시 뒤집거나 클라이언트에서 정렬
    // 여기서는 최신순으로 보내고 클라이언트에서 뒤집는 것이 더 효율적일 수 있음
    res.json(sensorData);
  } catch (error) {
    console.error('Error retrieving sensor data:', error); // 에러 로그 개선
    res.status(500).send('Error retrieving sensor data');
  }
});


// 클라이언트에서 센서 데이터를 불러오는 예제 (필요시 브라우저 콘솔 등에서 실행)
// fetch('/api/sensor-data')
//   .then(response => response.json())
//   .then(data => {
//     console.log(data);
//   });

// Socket.IO를 통한 실시간 데이터 수신 예제
// const socket = io();
// socket.on('newData', (data) => {
//   console.log('New sensor reading:', data);
// });
