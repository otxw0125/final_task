다음 엔드포인트들을 순서대로 확인하시면 전체 기능이 정상 동작하는지 검증할 수 있습니다:

인증(Auth)

POST /auth/signup

Body: { username, password }

→ 신규 사용자 생성

POST /auth/login

Body: { username, password }

→ 세션 발급 및 로그인

POST /auth/logout

→ 세션 파기 및 로그아웃

GET /auth/profile

→ 로그인 상태·유저 정보 확인

사용자 관리(Users)

GET /users

→ 모든 사용자 조회

GET /users/:id

→ 단일 사용자 조회

POST /users

Body: { username, password }

→ 사용자 생성

PATCH /users/:id

Body: { username?, password? }

→ 사용자 정보 업데이트

DELETE /users/:id

→ 사용자 삭제

센서 데이터(Sensor-Data)

POST /sensor-data

Body: { payload: "x,y,z" }

→ 가속도 데이터 파싱·저장

GET /sensor-data

→ 저장된 전체 센서 데이터 조회

ML 분석 결과(Ml-Results)

POST /ml-results

Body: { sensorId, resultPayload, timestamp }

→ ML 서버 분석 결과 저장

GET /ml-results

→ 전체 ML 결과 조회

GET /ml-results/:sensorId

→ 특정 센서 ID 연관 ML 결과 조회

각 엔드포인트에 대해 Insomnia 또는 curl로 요청을 보내 응답 코드를 확인해 보시고, 정상(2xx) 응답과 기대하는 JSON 구조가 나오는지 검증하세요.