const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http'); // http 모듈 추가
const socketIo = require('socket.io'); // socket.io 모듈 추가
const { MongoClient } = require('mongodb');
const { getSensorDataByUser } = require('./models/sensorDataModel');

// 시리얼 통신 관련 모듈
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// session 설정
app.use(session({
    secret: 'yourSecretKey',  
    resave: false,
    saveUninitialized: false
}));

// MongoDB 연결 정보
const uri = 'mongodb+srv://admin:dlghwns8391@sleepy.1jou6.mongodb.net/?retryWrites=true&w=majority';
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

// 시리얼 포트 설정 (autoOpen을 false로 하여 수동으로 열기)
const portSerial = new SerialPort({
  path: process.env.SERIAL_PORT || 'COM4', // 포트 이름을 환경 변수에서 불러오거나 기본값 사용
  baudRate: 9600,
  autoOpen: false
});

// 데이터 파서 설정
const parser = portSerial.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// 수동으로 시리얼 포트 열기
portSerial.open((err) => {
  if (err) {
    console.error('시리얼 포트를 열 수 없습니다:', err.message);
    // 추가: 테스트 모드로 전환하거나 후속 처리를 여기서 수행할 수 있습니다.
    return;
  }
  console.log('시리얼 포트가 성공적으로 열렸습니다.');
});

// 에러 이벤트 처리 (이미 연결되어 있던 포트에서 발생하는 에러)
portSerial.on('error', (err) => {
  console.error(`포트 오류: ${err.message}`);
});

// 시리얼 데이터 수신 처리 (각도를 MongoDB에 저장 및 실시간 전송)
parser.on('data', async (data) => {
  console.log(`수신된 데이터: ${data}`);
  
  try {
    const tilt = parseFloat(data);
    
    if (!isNaN(tilt)) {
      const sensorData = {
        userId: 'arduino_user', // 필요 시 세션 또는 설정에서 사용자 정보 대체
        tilt: tilt,
        timestamp: new Date()
      };
      
      // MongoDB에 센서 데이터 저장
      await db.collection('sensorData').insertOne(sensorData);
      
      // 최신 각도 배열 업데이트 (최대 10개 유지)
      latestAngleValues.push(tilt);
      if (latestAngleValues.length > 10) {
        latestAngleValues.shift();
      }
      
      // 실시간 데이터 전송 (Socket.IO)
      io.emit('newData', sensorData);
    }
  } catch (error) {
    console.error('Error processing serial data:', error);
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

// 로그인 POST 라우트
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.collection('users').findOne({ username: username });
        if (user && user.password === password) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.status(401).send('인증 실패: 잘못된 사용자 ID 또는 비밀번호.');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('로그인 처리 중 오류 발생');
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
  if (latestAngleValues.length > 10) {
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
app.get('/api/sensor-data', async (req, res) => {
  try {
    const sensorData = await db.collection('sensorData')
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    res.json(sensorData);
  } catch (error) {
    console.error(error);
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
