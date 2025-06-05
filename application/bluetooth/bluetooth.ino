#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>

// ADXL345 센서 객체 생성 (기본 I2C 주소 사용)
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified();

// --- HC-06 (Classic Bluetooth) 관련 ---
#include <SoftwareSerial.h>

const int bluetoothTx = 7; // 아두이노 7번 핀 -> HC-06 RXD 핀
const int bluetoothRx = 6; // 아두이노 6번 핀 <- HC-06 TXD 핀

SoftwareSerial hc06(bluetoothRx, bluetoothTx);

#define HC06_BAUD_RATE 9600 // HC-06 모듈의 기본 통신 속도 (모듈 설정과 일치해야 함)
// --- HC-06 관련 끝 ---


void setup() {
  // 시리얼 모니터 초기화 (컴퓨터와 통신) - 디버그 메시지 출력용
  Serial.begin(9600); // 시리얼 모니터 속도는 9600bps로 설정
  while (!Serial); // 시리얼 모니터 연결 대기 (선택 사항)
  Serial.println("--- Arduino 시리얼 모니터 시작됨 ---");

  // ADXL345 센서 초기화
  if (!accel.begin()) {
    Serial.println("ADXL345 센서를 찾을 수 없습니다. 연결을 확인하세요.");
    while (1); // 센서 없으면 무한 대기
  }
  accel.setRange(ADXL345_RANGE_4_G); // 측정 범위 설정 (필요에 따라 조절)
  Serial.println("ADXL345 센서 초기화 완료");
  delay(100); // 센서 안정화 대기

  // HC-06 (Classic Bluetooth) 시리얼 통신 초기화
  hc06.begin(HC06_BAUD_RATE); // SoftwareSerial 객체 초기화
  Serial.print("HC-06용 SoftwareSerial 초기화됨 (속도: ");
  Serial.print(HC06_BAUD_RATE);
  Serial.println(" bps).");
  Serial.println("Arduino Ready. Start sending data via Bluetooth."); // 시작 메시지 변경
  // --- 기준값 1회 전송 --- 
sensors_event_t event;
accel.getEvent(&event);

float x = event.acceleration.x;
float y = event.acceleration.y;
float z = event.acceleration.z;

String initialData = "X:" + String(x, 2) + ", Y:" + String(y, 2) + ", Z:" + String(z, 2);
Serial.println("기준값 전송: " + initialData);
hc06.println(initialData);  // Bluetooth로 1회 전송
delay(1000);  // 전송 안정화 대기
}


void loop() { // <--- loop() 함수 시작
     // ADXL345 센서 데이터 읽기
     sensors_event_t event;
     accel.getEvent(&event);

     // X, Y, Z 가속도 값 (단위: m/s^2)
     float x = event.acceleration.x;
     float y = event.acceleration.y;
     float z = event.acceleration.z;

if (Serial.availableForWrite() > 0) {
     Serial.print("현재 가속도 값 X:"); Serial.print(x);
Serial.print(", Y:"); Serial.print(y);
Serial.print(", Z:"); Serial.println(z);
}
     // HC-06 (Bluetooth)으로 값 전송 준비
     // 스마트폰 앱에서 파싱하기 쉬운 형식으로 데이터를 만듭니다.
     // 예시: "X:1.23,Y:4.56,Z:7.89\n"
     String dataString = "";
     dataString += "X:"; dataString += String(x, 2); // 소수점 2자리까지
     dataString += ", Y:"; dataString += String(y, 2);
     dataString += ", Z:"; dataString += String(z, 2);

     // HC-06 모듈로 데이터 전송 시도 메시지 출력 (디버깅용)
     Serial.print("데이터 전송 중"); // 전송 시도 시간 로그
     Serial.print(": "); Serial.println(dataString);

     // HC-06 모듈의 버퍼가 가득 차지 않았는지 확인하고 데이터 전송
     // 연결된 스마트폰이 있어야만 데이터가 전송됩니다.
     // hc06.availableForWrite()를 사용하여 버퍼 공간을 확인합니다.
     hc06.println(dataString);
Serial.print("데이터 전송 성공!");
Serial.println("");
delay(100);
   // --- 데이터 전송 로직 끝 ---

   // 데이터 전송 빈도를 조절하기 위해 적절한 delay를 추가하는 것을 고려해보세요.
   // delay(100); // 예: 100ms마다 센서 읽고 전송 (초당 약 10회)
   // delay 값을 작게 할수록 전송 빈도는 높아지지만, 수신 측에서 처리하기 어려울 수 있습니다.
   // HC-06 통신 속도(9600 bps)를 고려하여 적절한 delay를 설정하는 것이 좋습니다.
   // 9600 bps는 초당 약 960 바이트 전송 가능합니다.
   // "X:-12.34,Y:56.78,Z:90.12\n" 형태의 데이터는 대략 20 바이트 정도 됩니다.
   // 초당 50회 전송 시 20 * 50 = 1000 바이트/초 이므로, 9600 bps에서는 약간 빠를 수 있습니다.
   // delay(50) (20회/초) 또는 delay(100) (10회/초) 정도가 적당할 수 있습니다.
   delay(1000); // 기본적으로 100ms 대기 추가 (초당 10회 전송)

} 