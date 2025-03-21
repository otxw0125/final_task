const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const { getSensorDataByUser } = require('./models/sensorDataModel');

const app = express();

app.use(session({
    secret: 'yourSecretKey',  
    resave: false,
    saveUninitialized: false
}));

// MongoDB 연결 정보
const uri = 'mongodb+srv://admin:dlghwns8391@sleepy.1jou6.mongodb.net/?retryWrites=true&w=majority';
const dbName = 'ProjectDB';
let db;
let latestRandomValues = []; // 최근 난수 값을 저장할 배열

// MongoDB 연결
MongoClient.connect(uri)
  .then(client => {
    console.log('MongoDB에 연결되었습니다.');
    db = client.db(dbName);
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
    });
  })
  .catch(error => console.error('MongoDB 연결 오류:', error));

// EJS 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// JSON 요청을 처리하기 위한 미들웨어
// 정적 파일 경로 설정 (CSS, JS, 이미지 등)
app.use(express.static(path.join(__dirname, 'public')));

// POST 요청의 폼 데이터 파싱
app.use(express.urlencoded({ extended: true }));

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
// 로그인 POST 라우트
app.post('/login', async (req, res) => {
    const { username, password } = req.body;


    try {
        const user = await db.collection('users').findOne({ username: username });
        if (user && user.password === password) {
          // 로그인 성공 시 세션에 사용자 정보 저장
            req.session.user = user;
            res.redirect('/'); // 로그인 성공 시 리다이렉트
        } else {
            res.status(401).send('인증 실패: 잘못된 사용자 ID 또는 비밀번호.');
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

// 모니터링 페이지 라우트
app.get('/monitoring', (req, res) => {
  res.render('monitoring', { latestRandomValues }); // monitoring.ejs 페이지 렌더링
});

// 센서 데이터 수신용 POST 라우트
app.post('/api/sensorData', async (req, res) => {
  const { random_value } = req.body; // 아두이노에서 보낸 데이터
  latestRandomValues.push(random_value); // 최신 난수 값을 배열에 추가
  
  // 배열의 길이를 10으로 제한 (10개 초과 시 가장 오래된 값 삭제)
  if (latestRandomValues.length > 10) {
      latestRandomValues.shift(); // 가장 오래된 값 삭제
  }

  try {
      console.log('받은 난수 값:', random_value); // 콘솔에 난수 값 출력
      res.status(200).send('데이터가 성공적으로 저장되었습니다.');
  } catch (error) {
      console.error(error);
      res.status(500).send('데이터 저장 중 오류 발생');
  }
});

// 최신 센서 데이터 요청용 GET 라우트
app.get('/api/latestSensorData', (req, res) => {
  if (latestRandomValues.length > 0) {
      res.json({ random_values: latestRandomValues }); // JSON 형식으로 응답
  } else {
      res.status(404).send('난수 값이 없습니다.');
  }
});
// 기본 라우트 - 착석 자세 분석 결과 표시
// analyze 페이지: 로그인한 사용자의 센서 데이터 조회 후 전달
app.get('/analyze', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    // 센서 데이터 모델에서 사용자별 센서 데이터를 조회합니다.
    const sensorData = await getSensorDataByUser(db, req.session.user._id);
    res.render('analyze', { sensorData });
  } catch (error) {
    console.error(error);
    res.status(500).send('센서 데이터 조회 중 오류 발생');
  }
});

