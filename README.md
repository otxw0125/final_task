# final_task
추가한 사항 const { SerialPort }= require('serialport'); const { ReadlineParser }= require('@serialport/parser-readline');

// 시리얼 포트 설정 const portSerial = new SerialPort({

path: 'COM4', baudRate: 9600 // 아두이노와 동일한 보드레이트 설정 });

// 데이터 파서 설정 const parser = portSerial.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// 포트 열기 portSerial.on('open', () => { console.log('시리얼 포트가 열렸습니다.'); });

// 데이터 수신 처리 parser.on('data', (data) => { console.log(수신된 데이터: ${data}); });

// 에러 처리 portSerial.on('error', (err) => { console.error(포트 오류: ${err.message}); });

// 서버 종료 시 시리얼 포트 닫기 process.on('SIGINT', () => { console.log('서버 종료 중...'); portSerial.close((err) => { if (err) { return console.error('포트 닫기 오류:', err.message); } console.log('시리얼 포트가 닫혔습니다.'); process.exit(0); // 프로세스 종료 }); });