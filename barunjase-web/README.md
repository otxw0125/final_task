# 자세 교정 웹 애플리케이션

이 프로젝트는 사용자의 앉은 자세를 실시간으로 모니터링하고 분석하여 피드백을 제공함으로써, 사용자가 건강한 자세 습관을 형성하도록 돕는 웹 애플리케이션입니다.

## 1. 프로그램 사용 매뉴얼

### 1.1. 시스템 요구 사항

*   Node.js (권장 버전: LTS)
*   npm 또는 yarn
*   MongoDB 데이터베이스 인스턴스 (로컬 또는 클라우드)

### 1.2. 설치 및 실행

1.  **프로젝트 클론:**
    ```bash
    git clone <프로젝트_저장소_URL>
    cd <프로젝트_디렉토리>
    ```

2.  **의존성 패키지 설치:**
    ```bash
    npm install
    # 또는
    yarn install
    ```

3.  **환경 변수 설정:**
    *   프로젝트 루트에 `.env.local` 파일을 생성합니다.
    *   아래 내용을 참고하여 실제 환경에 맞게 값을 입력합니다. `.env.example` 파일이 있다면 해당 파일을 복사하여 사용하세요.
        ```env
        # MongoDB 연결 URI
        MONGODB_URI=mongodb://localhost:27017
        MONGODB_DB_NAME=postureAppDb

        # 자세 평가 로직 관련 상수 (필요시 JSON 문자열 형태로 입력)
        # 예: FEEDBACK_NORMAL_RANGES='{"X":{"min":-10,"max":10},"Y":{"min":-5,"max":5},"Z":{"min":-5,"max":5}}'
        # FEEDBACK_RISK_THRESHOLDS='{"warning":5,"danger":10}'
        # FEEDBACK_SCORE_WEIGHTS='{"X":0.4,"Y":0.4,"Z":0.2}'
        # FEEDBACK_MAX_DEVIATION_FOR_SCORE=25
        # FEEDBACK_CURRENT_TTL_SECONDS=5 # 최신 피드백 캐시 TTL (초)

        # 기타 필요한 환경변수
        # NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api # 클라이언트에서 API 호출 시 기본 URL
        ```

4.  **개발 서버 실행:**
    ```bash
    npm run dev
    # 또는
    yarn dev
    ```

5.  **애플리케이션 접속:**
    웹 브라우저에서 `http://localhost:3000` (또는 터미널에 표시된 포트)으로 접속합니다.

### 1.3. 주요 기능 사용법

*   **대시보드 (`/dashboard`):**
    *   애플리케이션의 메인 페이지입니다.
    *   실시간으로 현재 자세에 대한 피드백을 확인할 수 있습니다.
    *   **자세 아바타**: 현재 감지된 자세(상체 기울기, 비틀림)를 시각적으로 보여줍니다. 의자에 앉은 모습과 함께 각 축의 위험도가 색상으로 표현됩니다.
    *   **종합 점수**: 현재 자세를 0점에서 100점 사이의 점수로 평가하여 보여줍니다.
    *   **요약 및 조언**: 자세에 대한 간략한 요약 메시지와 개선을 위한 구체적인 조언을 제공합니다.
    *   **위험도 알림**: 자세가 '주의' 또는 '위험' 수준으로 감지되면 시각적 알림 (예: 카드 배경색 변경) 및 브라우저 알림(활성화 시)을 받을 수 있습니다.
    *   **과거 데이터 시각화**: 시간대별 자세 점수 변화 추이, 평균 점수, 자주 발생한 자세 문제 등을 차트와 목록으로 확인할 수 있습니다. (기간 선택 가능)

*   **자세 가이드 (`/posture-guide`):**
    *   올바른 자세에 대한 일반적인 정보와 팁을 제공하는 페이지입니다. (현재 ISR 적용, 1시간 주기 업데이트)

*   **관리자용 데이터 뷰어 (`/admin/data-viewer`):**
    *   최근 수집된 원본 센서 데이터(`RawSensorData`)와 이를 변환하여 생성된 각도 데이터 및 피드백(`AngleData`)을 표 형태로 직접 확인할 수 있습니다. 데이터 처리 과정을 디버깅하거나 검증할 때 유용합니다.

### 1.4. 센서 데이터 전송 (테스트용)

이 애플리케이션은 외부 센서로부터 자세 데이터를 받아 처리하도록 설계되었습니다. 실제 센서가 없는 개발 환경에서는 제공된 PowerShell 스크립트를 사용하여 더미 데이터를 생성하고 API를 통해 전송할 수 있습니다.

1.  **더미 `RawSensorData` 생성 및 전송:**
    *   프로젝트 내 `create_dummy_raw_data.ps1` 스크립트를 찾습니다.
    *   스크립트 내의 API URL(`$apiUrl`)이 현재 실행 중인 개발 서버의 주소 (`http://localhost:3000/api/sensor-data/raw`)와 일치하는지 확인합니다.
    *   PowerShell 또는 터미널에서 스크립트를 실행합니다.
        ```powershell
        ./create_dummy_raw_data.ps1
        ```
    *   스크립트는 주기적으로 무작위 가속도 센서 값을 생성하여 백엔드 API로 전송합니다.

2.  **`RawSensorData`를 `AngleData`로 변환 (테스트용):**
    *   백엔드에는 `RawSensorData`를 받아서 각도로 변환하고, 자세 평가를 수행한 후 `AngleData`로 저장하는 API(`POST /api/raw-to-angle`)가 구현되어 있습니다.
    *   일반적으로 센서 데이터 수신 시 이 변환 과정이 자동으로 트리거되거나, 별도의 처리 로직에 의해 주기적으로 실행될 수 있습니다.
    *   테스트를 위해 `test_raw_to_angle_conversion.ps1` 스크립트를 실행하여 수동으로 최근 `RawSensorData`를 변환하고 `AngleData`를 생성/저장할 수 있습니다.
        ```powershell
        ./test_raw_to_angle_conversion.ps1
        ```
    *   이 과정을 통해 대시보드에서 사용될 분석된 자세 데이터가 생성됩니다.

## 2. 코드 설계 및 구조

### 2.1. 목표

본 프로젝트는 사용자의 앉은 자세를 실시간으로 측정하고 분석하여 즉각적인 피드백을 제공함으로써, 사용자가 스스로 자세를 교정하고 장기적으로 건강한 습관을 형성할 수 있도록 지원하는 것을 목표로 합니다.

### 2.2. 주요 기술 스택

*   **프레임워크**: Next.js (React 기반, App Router 사용)
*   **언어**: TypeScript
*   **데이터베이스**: MongoDB (Mongoose ODM 사용)
*   **UI 스타일링**: Tailwind CSS
*   **상태 관리**: React Context API, `useState`, `useEffect` (컴포넌트 로컬 상태 및 서버 상태 동기화)
*   **테스팅**: Jest (단위/컴포넌트 테스트), Playwright (E2E 테스트)
*   **API**: Next.js Route Handlers (서버리스 함수 형태로 API 구현)

### 2.3. 데이터 흐름 및 처리 과정

애플리케이션의 핵심 데이터 흐름은 다음과 같습니다.

1.  **센서 데이터 수집 (`RawSensorData`)**:
    *   외부 센서(또는 더미 데이터 생성기)로부터 3축 가속도 값(x, y, z)을 포함하는 원시 데이터를 수신합니다.
    *   **API**: `POST /api/sensor-data/raw`
    *   **저장**: MongoDB `rawsensordata` 컬렉션

2.  **각도 변환 및 자세 평가 (`AngleData` 생성)**:
    *   수집된 `RawSensorData`를 사용하여 각 축(상체 앞뒤 기울기-X, 상체 좌우 기울기-Y, 몸통 비틀림-Z)의 각도를 계산합니다.
        *   **로직**: `lib/utils/conversion.ts` - `convertAccelToAngles` 함수
    *   계산된 각도를 기반으로 자세를 평가하여 점수, 위험도, 요약 메시지, 상세 조언 등을 생성합니다.
        *   **로직**: `lib/utils/postureEvaluator.ts` - `generatePostureFeedbackFromAngleData` 함수
    *   이 모든 정보(타임스탬프, 원본 센서 ID, 각도, 평가 결과)를 `AngleData` 객체로 통합합니다.
    *   **API**: `POST /api/raw-to-angle` (내부적으로 위 로직들을 호출하여 `AngleData`를 생성하고 저장)
    *   **저장**: MongoDB `angledata` 컬렉션 (타임스탬프 인덱싱 적용)

3.  **피드백 제공 (API 및 UI)**:
    *   **최신 자세 피드백**:
        *   `angledata` 컬렉션에서 가장 최근의 데이터를 조회하여 현재 자세 정보를 제공합니다.
        *   서버에서 실시간 계산 및 평가 결과가 `AngleData`에 이미 저장되어 있다면 이를 우선 사용합니다.
        *   인메모리 캐시(`lib/cache/memoryCache.ts`)를 적용하여 반복적인 DB 조회를 최소화하고 응답 속도를 향상시킵니다.
        *   **API**: `GET /api/feedback/current`
        *   **서버 컴포넌트 데이터 페칭**: `lib/data/feedback.ts` - `getCurrentPostureFeedbackForServer`
        *   **UI**: `CurrentPostureFeedbackCard.tsx`, `PostureAvatar.tsx` (대시보드)
    *   **과거 자세 피드백 (히스토리)**:
        *   사용자가 요청한 기간 동안의 `angledata`를 조회하고, 시간 단위별(일/시간) 평균 점수, 문제점 등을 집계하여 제공합니다.
        *   **API**: `GET /api/feedback/history`
        *   **서버 컴포넌트 데이터 페칭**: `lib/data/feedback.ts` - `getPostureHistoryForServer`
        *   **UI**: `PostureHistoryVisualization.tsx` (대시보드)

```text
        센서 데이터 (Raw)               각도 변환 및 평가               피드백 API/UI
+-----------------------+     +---------------------------+     +---------------------+
| POST /api/sensor-data/raw | --> | POST /api/raw-to-angle    | --> | GET /api/feedback/* |
| (RawSensorData 모델)  |     | (AngleData 모델 생성/저장)|     | (대시보드 UI 등)    |
| - 가속도 값 (x,y,z)   |     | - convertAccelToAngles    |     | - PostureAvatar     |
| - timestamp           |     | - generatePostureFeedback |     | - FeedbackCard      |
+-----------------------+     +---------------------------+     +---------------------+
          |                               |
          v                               v
+-----------------------+     +---------------------------+
| MongoDB: rawsensordata|     | MongoDB: angledata        |
| 컬렉션                |     | 컬렉션 (평가 결과 포함)   |
+-----------------------+     +---------------------------+
```

### 2.4. 주요 디렉토리 구조 및 역할

*   **`app/`**: Next.js App Router를 사용하는 디렉토리. 페이지, 레이아웃, API 라우트 핸들러 등이 위치합니다.
    *   `app/api/`: 모든 백엔드 API 로직을 포함합니다. 각 API 엔드포인트는 디렉토리 구조로 매핑됩니다.
        *   `feedback/current/route.ts`: 최신 자세 피드백 API.
        *   `feedback/history/route.ts`: 과거 자세 피드백 API.
        *   `raw-to-angle/route.ts`: 원시 데이터를 각도 데이터로 변환 및 저장하는 API.
        *   `sensor-data/raw/route.ts`: 원시 센서 데이터를 수신하는 API.
    *   `app/dashboard/page.tsx`: 메인 대시보드 페이지. 서버 컴포넌트로 구현되어 초기 데이터 로딩 및 `Suspense`를 활용한 로딩 UI를 처리합니다.
    *   `app/admin/data-viewer/page.tsx`: 관리자용 데이터 확인 페이지.
    *   `app/posture-guide/page.tsx`: 자세 가이드 정적 페이지 (ISR 적용).
*   **`components/`**: 재사용 가능한 React UI 컴포넌트 모음.
    *   `components/visualization/PostureAvatar.tsx`: 사용자의 현재 자세를 의자, 인체 실루엣, 각도 게이지 등으로 시각화하는 컴포넌트.
    *   `components/feedback/CurrentPostureFeedbackCard.tsx`: 최신 자세 점수, 메시지, 조언 등을 표시하고 주기적으로 API를 호출하여 업데이트하는 카드 컴포넌트.
    *   `components/history/PostureHistoryVisualization.tsx`: 과거 자세 데이터를 차트와 표로 시각화하는 컴포넌트.
*   **`lib/`**: 애플리케이션의 핵심 로직, 유틸리티 함수, 데이터베이스 관련 설정 등을 포함합니다.
    *   `lib/db/`: MongoDB 연결 설정(`connectDB.ts`) 및 컬렉션 인스턴스 반환 함수(`collections.ts`)를 관리합니다.
    *   `lib/models/`: Mongoose 스키마를 사용하여 데이터 모델(`AngleData.ts`, `RawSensorData.ts`)을 정의합니다.
    *   `lib/utils/`: 핵심 변환 및 계산 로직.
        *   `conversion.ts`: 가속도 센서 데이터를 각도로 변환하는 함수.
        *   `postureEvaluator.ts`: 각도 데이터를 기반으로 자세를 평가하고 피드백을 생성하는 함수.
    *   `lib/cache/memoryCache.ts`: 간단한 인메모리 캐시 유틸리티.
    *   `lib/data/feedback.ts`: 서버 컴포넌트에서 사용하기 위한 데이터 페칭 함수 (최신 피드백, 과거 피드백 조회).
*   **`public/`**: 정적 에셋 (이미지 등)을 저장합니다.
*   **`tests/`**: 테스트 코드 (Jest, Playwright)를 포함합니다. (E2E 테스트는 프로젝트 루트 `playwright/` 또는 `tests/e2e` 등에 위치할 수 있음)

### 2.5. 주요 설계 결정 및 특징

*   **SSR 및 서버 컴포넌트 활용**: 대시보드(`app/dashboard/page.tsx`)는 Next.js 서버 컴포넌트로 구현하여 초기 로딩 성능을 최적화하고, 데이터 페칭 로직을 서버 사이드에서 처리합니다. `Suspense`를 사용하여 데이터 로딩 중에는 스켈레톤 UI 등을 보여줍니다.
*   **API 중심 아키텍처**: 프론트엔드와 백엔드 로직을 명확히 분리하기 위해 API 엔드포인트를 적극적으로 활용합니다.
*   **데이터 일원화**: `RawSensorData` 수신 후 `AngleData`로 변환/평가하여 저장하는 흐름을 통해, 분석된 데이터를 일관되게 관리하고 API를 통해 제공합니다.
*   **성능 최적화**:
    *   최신 피드백 API(`GET /api/feedback/current`)에 인메모리 캐시를 적용하여 DB 부하를 줄입니다.
    *   MongoDB `angledata` 컬렉션의 `timestamp` 필드에 인덱스를 생성하여 시간 기반 조회 성능을 향상시킵니다.
    *   `app/posture-guide/page.tsx`와 같이 자주 변경되지 않는 페이지에는 ISR(Incremental Static Regeneration)을 적용하여 빌드 시점에 정적 생성 후 주기적으로 업데이트합니다.
*   **모듈화된 로직**: 각도 변환, 자세 평가 등의 핵심 로직을 `lib/utils/` 디렉토리 하위의 독립적인 모듈로 분리하여 재사용성 및 테스트 용이성을 높였습니다.
*   **환경 변수 관리**: 주요 설정값(DB 연결 정보, 피드백 상수 등)을 환경 변수로 분리하여 배포 환경에 따라 유연하게 설정할 수 있도록 했습니다.
*   **시각화 중심의 피드백**: `PostureAvatar` 컴포넌트를 통해 사용자가 자신의 자세를 직관적으로 이해하고 문제점을 파악할 수 있도록 시각적인 피드백을 강화했습니다.

이러한 설계를 통해 실시간 데이터 처리, 효율적인 데이터 관리, 사용자 친화적인 인터페이스를 제공하는 자세 교정 애플리케이션을 구현하고자 했습니다.