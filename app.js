// app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const { getSensorDataByUser } = require('./models/sensorDataModel');
// 시리얼 통신
const { SerialPort }= require('serialport');
const { ReadlineParser }= require('@serialport/parser-readline');

const app = express();

app.use(session({
    secret: 'yourSecretKey',  // 보안을 위해 실제 서비스에서는 더 복잡한 값 사용
    resave: false,
    saveUninitialized: false
  }));

// MongoDB 연결 정보
const uri = 'mongodb+srv://admin:dlghwns8391@sleepy.1jou6.mongodb.net/?retryWrites=true&w=majority';
const dbName = 'ProjectDB';
let db;

const testUserId = "test";

// MongoDB 연결
MongoClient.connect(uri)
  .then(client => {
    console.log('MongoDB에 연결되었습니다.');
    db = client.db(dbName);

     // 서버 시작 전에 테스트 센서 데이터 10개 삽입
     const data = generateRandomSensorData();
     db.collection('sensorData').insertMany(data)
       .then(result => {
         console.log(`Test sensor data inserted: ${result.insertedCount}개`);
       })
       .catch(error => console.error('Test data 삽입 중 오류:', error));
 
    // 서버 실행
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});

  })
  .catch(error => console.error('MongoDB 연결 오류:', error));
// 예시: sensorData를 DB에 삽입하는 함수 (콜백 방식)
// 난수 센서 데이터를 생성하는 함수
function generateRandomSensorData() {
  const sensorData = [];
  for (let i = 0; i < 10; i++) {
    // -10.0 ~ 10.0 사이의 난수 (소수점 둘째 자리까지)
    const tilt = parseFloat((Math.random() * 20 - 10).toFixed(2));
    sensorData.push({
      user_Id: testUserId, // testUserId가 정의되어 있어야 합니다.
      tilt: tilt,
      timestamp: new Date()
    });
  }
  return sensorData;
}
// 테스트 센서 데이터를 DB에 삽입하는 함수 (콜백 방식)
function insertTestSensorData(callback) {
  const sensorData = generateRandomSensorData();
  db.collection('sensorData').insertMany(sensorData, (err, result) => {
    if (err) {
      console.error("데이터 삽입 중 오류:", err);
      return callback(err, null);
    }
    console.log(`${result.insertedCount}개의 문서가 삽입되었습니다.`);
    callback(null, result);
  });
}

// EJS 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 정적 파일 경로 설정 (CSS, JS, 이미지 등)
app.use(express.static(path.join(__dirname, 'public')));

// POST 요청의 폼 데이터 파싱
app.use(express.urlencoded({ extended: true }));

// 시리얼 포트 설정
const portSerial = new SerialPort({
  
  path: 'COM4',
  baudRate: 9600 // 아두이노와 동일한 보드레이트 설정
});

// 데이터 파서 설정
const parser = portSerial.pipe(new ReadlineParser({ delimiter: '\r\n' }));
// 포트 열기
if (portSerial) {
  portSerial.on('open', () => {
    console.log('시리얼 포트가 열렸습니다.');
  });

  // 에러 처리
  portSerial.on('error', (err) => {
    console.error(`포트 오류: ${err.message}`);
  });
}

// 데이터 수신 처리 (parser가 있다면)
if (typeof parser !== 'undefined') {
  parser.on('data', (data) => {
    console.log(`수신된 데이터: ${data}`);
  });
}

// 서버 종료 시 시리얼 포트 닫기
process.on('SIGINT', () => {
  console.log('서버 종료 중...');
  if (portSerial && portSerial.isOpen) {
    portSerial.close((err) => {
      if (err) {
        console.error('포트 닫기 오류:', err.message);
      } else {
        console.log('시리얼 포트가 닫혔습니다.');
      }
      process.exit(0); // 프로세스 종료
    });
  } else {
    console.log('시리얼 포트가 열려있지 않습니다. 서버를 종료합니다.');
    process.exit(0);
  }
});
// 기본 홈페이지: 로그인 상태에 따라 서로 다른 페이지 렌더링
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
      // 로그인 상태라면 대시보드 페이지 렌더링
      res.render('dashboard', { user: req.session.user });
    } else {
      // 로그인하지 않은 경우 기존 index 페이지 렌더링
      res.render('index');
    }
  });
  
// 로그인 페이지: 박스 안에 username, password 입력창, 하단에 회원가입 링크
app.get('/login', (req, res) => {
    res.render('login');
  });

// 로그인 POST 라우트: 사용자 인증 후 세션에 사용자 정보 저장
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await db.collection('users').findOne({ username: username });
      if (user && user.password === password) {
        // 로그인 성공 시 세션에 사용자 정보 저장
        req.session.user = user;
        res.redirect('/');  // index 라우트가 로그인 상태를 체크하여 대시보드 페이지를 렌더링함
      } else {
        res.render('login_failure');
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('로그인 처리 중 오류 발생');
    }
  });
  
// 회원가입 페이지: sign-up 폼 제공
app.get('/signup', (req, res) => {
    res.render('signup');
});

// 회원가입 POST 라우트: 폼 데이터를 받아 MongoDB에 저장 후 가입 완료 페이지 렌더링
app.post('/signup', async (req, res) => {
    const { username, email, password, uniqueKey } = req.body;
    const userData = {
      username,
      email,
      password,
      uniqueKey: uniqueKey || ""  // uniqueKey가 입력되지 않으면 빈 문자열로 저장
    };
  
    try {
      await db.collection('users').insertOne(userData);
      res.render('signup_success'); // 가입 완료 페이지 렌더링
    } catch (error) {
      console.error(error);
      res.status(500).send('회원가입 처리 중 오류 발생');
    }
  });
  

// 기본 라우트 - 착석 자세 분석 결과 표시
// analyze 페이지: 로그인한 사용자의 센서 데이터 조회 후 전달
// /analyze 페이지: test 계정의 센서 데이터를 조회하여 평균 및 기울기 메시지 표시
app.get('/analyze', async (req, res) => {
  try {
    // test 계정에 해당하는 센서 데이터를 모두 조회
    const sensorData = await db.collection('sensorData').find({ userId: testUserId }).toArray();
    if (sensorData.length === 0) {
      return res.send("센서 데이터가 없습니다.");
    }
    // 평균 계산
        // 평균 센서 데이터 계산
        const sum = sensorData.reduce((acc, curr) => acc + curr.tilt, 0);
        const avg = sum / sensorData.length;
        
        // 히스토그램을 위한 bins 생성 (-10 ~ 10, 1 단위 → 21개의 bin)
        const bins = Array(21).fill(0);
        sensorData.forEach(data => {
          let tilt = data.tilt;
          // -10과 10의 범위를 벗어나면 클램핑
          if (tilt < -10) tilt = -10;
          if (tilt > 10) tilt = 10;
          // tilt + 10는 0 ~ 20 범위를 만들며, Math.floor로 bin 인덱스를 결정
          const binIndex = Math.floor(tilt + 10);
          bins[binIndex]++;
        });
        
        res.render('analyze', { 
          average: avg.toFixed(2),  // 평균값 (소수점 둘째 자리)
          bins: bins, 
          sensorData: sensorData 
        });
      } catch (error) {
        console.error(error);
        res.status(500).send('센서 데이터 조회 중 오류 발생');
      }
    });