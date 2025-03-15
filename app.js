// app.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoClient } = require('mongodb');
// 추가된 부분 (시리얼 통신)
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

// MongoDB 연결
MongoClient.connect(uri)
  .then(client => {
    console.log('MongoDB에 연결되었습니다.');
    db = client.db(dbName);
    // 서버 실행
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});

  })
  .catch(error => console.error('MongoDB 연결 오류:', error));

// EJS 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
app.get('/analyze', async (req, res) => {
  // 예시: MongoDB에서 분석 결과를 가져오는 코드 (주석 처리)
  // const analysis = await db.collection('analysis').findOne({});
  
  // 임시 데이터 (추후 MongoDB 데이터로 대체)
  const analysis = { posture: '좋음', score: 90 };
  res.render('analyze', { analysis });
});

