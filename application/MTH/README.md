# MTH (바른자세) 안드로이드 애플리케이션

아두이노 센서 데이터를 MongoDB에 저장하는 안드로이드 애플리케이션입니다.

## 기능

- 아두이노 HC-06 블루투스 모듈을 통한 가속도 센서 데이터 수신
- MongoDB에 직접 센서 데이터 저장
- 백엔드 서버를 통한 데이터 저장 (선택사항)
- 실시간 자세 모니터링 및 알림
- 센서 데이터 시각화 차트

## MongoDB 설정

### 1. 직접 연결 방식 (현재 구현됨)

#### 환경 변수 설정
`MainActivity.java`에서 다음 상수들을 수정하세요:

```java
private static final String MONGODB_APP_ID = "your-realm-app-id"; // MongoDB Realm App ID
private static final String MONGODB_URI = "mongodb+srv://admin:Dlghwns8391@sleepy.1jou6.mongodb.net/?retryWrites=true&w=majority";
private static final String MONGODB_DB_NAME = "barunjase";
private static final String MONGODB_COLLECTION_NAME = "rawsensordata";
```

#### MongoDB Realm 설정
1. [MongoDB Atlas](https://www.mongodb.com/atlas)에 로그인
2. 새 Realm 앱 생성
3. 앱 ID를 `MONGODB_APP_ID`에 설정
4. 인증 방식 설정 (익명 로그인 또는 API 키)

#### 실제 사용을 위한 코드 활성화
`MainActivity.java`의 다음 메서드들에서 주석을 해제하세요:
- `initializeMongoDB()`: MongoDB 연결 초기화
- `saveAccelerationToMongoDB()`: 데이터 저장

### 2. 백엔드 서버 방식 (선택사항)

백엔드 서버를 사용하려면:

1. `processReceivedData()` 메서드에서 다음과 같이 변경:
```java
// MongoDB에 직접 데이터 저장
// saveAccelerationToMongoDB(x, y, z);

// 백엔드 서버로 데이터 전송 (백엔드 방식 사용 시)
sendAccelerationToBackend(x, y, z);
```

2. 백엔드 서버 실행 (파일 하단 주석 참조)

## 데이터 스키마

MongoDB `rawsensordata` 컬렉션에 저장되는 데이터 구조:

```json
{
  "_id": "ObjectId",
  "x_accel": 1.23,
  "y_accel": 4.56,
  "z_accel": 7.89,
  "timestamp": 1699123456789,
  "device_id": "android_device_001",
  "created_at": "2023-11-04T12:34:56.789Z"
}
```

## 필요한 권한

- `BLUETOOTH`: 블루투스 기본 권한
- `BLUETOOTH_ADMIN`: 블루투스 관리 권한
- `BLUETOOTH_CONNECT`: 블루투스 연결 권한 (Android 12+)
- `BLUETOOTH_SCAN`: 블루투스 스캔 권한 (Android 12+)
- `ACCESS_FINE_LOCATION`: 위치 권한 (블루투스 스캔용)
- `ACCESS_COARSE_LOCATION`: 위치 권한 (구형 기기용)
- `POST_NOTIFICATIONS`: 알림 권한 (Android 13+)
- `INTERNET`: 인터넷 연결 권한
- `ACCESS_NETWORK_STATE`: 네트워크 상태 확인 권한

## 설치 및 실행

1. Android Studio에서 프로젝트 열기
2. `build.gradle` 동기화
3. MongoDB 설정 완료
4. 아두이노 HC-06 모듈과 페어링
5. 앱 실행 및 블루투스 연결

## 아두이노 코드 예시

```cpp
// 아두이노에서 전송해야 하는 데이터 형식
// "X:1.23,Y:4.56,Z:7.89\n"

void setup() {
  Serial.begin(9600);
  // 센서 초기화
}

void loop() {
  float x = readXAccel();
  float y = readYAccel();
  float z = readZAccel();
  
  Serial.print("X:");
  Serial.print(x, 2);
  Serial.print(",Y:");
  Serial.print(y, 2);
  Serial.print(",Z:");
  Serial.println(z, 2);
  
  delay(1000); // 1초마다 전송
}
```

## 문제 해결

### MongoDB 연결 실패
- Realm App ID가 올바른지 확인
- 네트워크 연결 상태 확인
- MongoDB Atlas 클러스터 상태 확인

### 블루투스 연결 실패
- HC-06 모듈이 페어링되었는지 확인
- 블루투스 권한이 허용되었는지 확인
- 아두이노 코드가 올바른 형식으로 데이터를 전송하는지 확인

### 데이터 저장 실패
- 인터넷 연결 상태 확인
- MongoDB 컬렉션 권한 설정 확인
- 로그를 통해 오류 메시지 확인 