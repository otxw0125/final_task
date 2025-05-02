#include <Adafruit_ADXL345_U.h>

#include <WiFiEspAT.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#define I2C_Address 0x53

Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified();

const int ledPin = 13; // LED 핀은 그대로 두되, 자세 관련 로직에서는 제거했습니다.

// 초기 (기준) 가속도 값 저장 변수
float initialX = 0;
float initialY = 0;
float initialZ = 0;


// Emulate Serial1 on pins 6/7 if not present
#if defined(ARDUINO_ARCH_AVR) && !defined(HAVE_HWSERIAL1)
#include <SoftwareSerial.h>
SoftwareSerial Serial1(6, 7); // RX, TX
#define AT_BAUD_RATE 9600
#else
#define AT_BAUD_RATE 115200
#endif

const char* server = "192.168.95.251"; // 서버 IP 주소
const int serverPort = 3000;             // 서버 포트
const char* apiEndpoint = "/api/sensorData"; // API 엔드포인트
WiFiClient client;

void setup() {
  Serial.begin(9600); // 시리얼 통신 속도 설정

  pinMode(ledPin, OUTPUT); // LED 핀 출력 설정

  // ADXL345 센서 초기화
  if (!accel.begin()) {
    Serial.println("ADXL345 센서를 찾을 수 없습니다.");
    while (1); // 센서 초기화 실패 시 무한 대기
  }

  accel.setRange(ADXL345_RANGE_4_G); // 가속도 측정 범위 설정 (필요에 따라 변경)

  // 시리얼 포트가 준비될 때까지 대기
  while (!Serial);

  // WiFi 모듈과의 통신을 위해 Serial1 (또는 SoftwareSerial) 설정
  Serial1.begin(AT_BAUD_RATE);
  WiFi.init(Serial1);

  // WiFi 모듈 연결 확인
  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println();
    Serial.println("Communication with WiFi module failed!");
    while (true); // 모듈 통신 실패 시 무한 대기
  }

  // WiFi 네트워크 연결 대기
  Serial.println("Waiting for connection to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print('.');
  }
  Serial.println();
  Serial.println("Connected to WiFi network.");

  // **초기 (기준) 가속도 값 측정 및 저장**
  sensors_event_t initial_event;
  accel.getEvent(&initial_event);
  initialX = initial_event.acceleration.x;
  initialY = initial_event.acceleration.y;
  initialZ = initial_event.acceleration.z;

  Serial.println("가속도 값 초기화:");
  Serial.print("초기 X: "); Serial.print(initialX);
  Serial.print("\t초기 Y: "); Serial.print(initialY);
  Serial.print("\t초기 Z: "); Serial.println(initialZ);


  // 서버 연결 (setup에서 한 번 시도)
  Serial.print("Connecting to server...");
  if (client.connect(server, serverPort)) { // serverPort 변수 사용
    Serial.println("Connected to server");
     digitalWrite(ledPin, HIGH); // 연결 성공 시 LED 켜기 (선택 사항)
  } else {
    Serial.println("Connection failed");
     digitalWrite(ledPin, LOW); // 연결 실패 시 LED 끄기 (선택 사항)
  }
}

void loop() {
  sensors_event_t event;
  accel.getEvent(&event); // 현재 가속도 값 읽기

  // 현재 가속도 값 시리얼 출력 (디버깅용)
  Serial.print("현재 X: "); Serial.print(event.acceleration.x);
  Serial.print("\t현재 Y: "); Serial.print(event.acceleration.y);
  Serial.print("\t현재 Z: "); Serial.println(event.acceleration.z);

  // 각도 계산 및 각도 기반 LED 제어 로직 삭제

  // 서버에 현재 X, Y, Z 값 전송
  sendSensorDataToServer(event.acceleration.x, event.acceleration.y, event.acceleration.z);

  // 클라이언트 연결 상태 확인 및 재연결 시도
  if (!client.connected()) {
    Serial.println("Client disconnected. Attempting to reconnect..."); // 재연결 시도 메시지 추가
    if (client.connect(server, serverPort)) {
      Serial.println("Reconnected to server");
      digitalWrite(ledPin, HIGH); // 재연결 성공 시 LED 켜기 (선택 사항)
    } else {
      Serial.println("Reconnection failed");
      digitalWrite(ledPin, LOW); // 재연결 실패 시 LED 끄기 (선택 사항)
      delay(5000); // 5초 후 재시도
    }
  }

  delay(1000); // 1초 대기 (데이터 전송 빈도 조절)
}

// 센서 데이터 (X, Y, Z 값)를 서버로 전송하는 함수
void sendSensorDataToServer(float x, float y, float z) {
  if (!client.connected()) {
     Serial.println("Client not connected, cannot send data.");
     return;
  }

  // 전송할 데이터 문자열 생성 (application/x-www-form-urlencoded 형식)
  // 예: x=1.23&y=4.56&z=7.89
  String data = "x=" + String(x) + "&y=" + String(y) + "&z=" + String(z);

  // --- HTTP POST 요청 구성 및 전송 ---
  client.print("POST "); // HTTP 메소드
  client.print(apiEndpoint); // 경로
  client.print(" HTTP/1.1\r\n"); // HTTP 버전 및 개행

  client.print("Host: "); // Host 헤더
  client.print(server); // 서버 IP 또는 도메인
  client.print("\r\n"); // 개행

  client.print("Content-Type: application/x-www-form-urlencoded\r\n"); // Content-Type 헤더

  client.print("Content-Length: "); // Content-Length 헤더
  client.print(data.length()); // 데이터 길이
  client.print("\r\n"); // 개행

  client.print("Connection: keep-alive\r\n"); // Connection 헤더 (서버 설정에 따라 조정 가능)
  client.print("\r\n"); // **헤더와 바디를 구분하는 빈 줄 (매우 중요!)**

  client.print(data); // 요청 바디 데이터

  client.flush(); // 송신 버퍼 비우기

  Serial.println("Current sensor data (X, Y, Z) sent to server");

  // --- 서버 응답 대기 및 처리 (선택 사항) ---
  // 서버 응답을 확인하고 싶다면 이 부분을 활성화하고 응답 코드를 파싱합니다.
  // 현재는 응답이 있는지 100ms만 확인합니다.
  unsigned long timeout = millis();
  while (client.available() && millis() - timeout < 100) { // 100ms 대기
      char c = client.read();
      // Serial.print(c); // 응답 내용을 시리얼 모니터에 출력하고 싶다면 이 줄을 활성화
  }
}

