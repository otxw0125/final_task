# final_task
추가한 사항 const { SerialPort }= require('serialport'); const { ReadlineParser }= require('@serialport/parser-readline');

// 시리얼 포트 설정 const portSerial = new SerialPort({

path: 'COM4', baudRate: 9600 // 아두이노와 동일한 보드레이트 설정 });

// 데이터 파서 설정 const parser = portSerial.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// 포트 열기 portSerial.on('open', () => { console.log('시리얼 포트가 열렸습니다.'); });

// 데이터 수신 처리 parser.on('data', (data) => { console.log(수신된 데이터: ${data}); });

// 에러 처리 portSerial.on('error', (err) => { console.error(포트 오류: ${err.message}); });

// 서버 종료 시 시리얼 포트 닫기 process.on('SIGINT', () => { console.log('서버 종료 중...'); portSerial.close((err) => { if (err) { return console.error('포트 닫기 오류:', err.message); } console.log('시리얼 포트가 닫혔습니다.'); process.exit(0); // 프로세스 종료 }); });

지금 analyze 페이지 열면 실시간으로 데이터 변경되는거 확인 가능함.
그래서 나 이제 뭐함?

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
let latestAngleValues = []; // 최근 각도도 값을 저장할 배열

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
app.use(express.static(path.join(__dirname, 'public')음
