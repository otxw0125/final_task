//file lib/algorithms/angleConverter.ts
import { MultiAxisKalmanFilter } from './kalmanFilter';

/**
 * 가속도 센서 데이터를 각도로 변환하는 알고리즘
 * 
 * 이 모듈은 3축 가속도 센서 데이터를 받아서 다음과 같은 각도로 변환합니다:
 * - X축 각도 (피치): 목의 앞뒤 기울기
 * - Y축 각도 (롤): 허리의 좌우 기울기  
 * - Z축 각도 (요): 몸의 회전
 * 
 * 칼만 필터를 적용하여 센서 노이즈를 제거하고 안정적인 각도 값을 제공합니다.
 */

// 전역 칼만 필터 인스턴스 (X, Y, Z 축에 대해 각각 독립적으로 필터링)
const kalmanFilter = new MultiAxisKalmanFilter(
  ['X', 'Y', 'Z'],
  0.01,  // 프로세스 노이즈 (작을수록 더 부드러운 결과)
  0.1    // 측정 노이즈 (클수록 측정값을 덜 신뢰)
);

/**
 * 각도 변환 결과 인터페이스
 */
export interface AngleResult {
  X: number; // 피치 각도 (목의 앞뒤 기울기, -90도 ~ +90도)
  Y: number; // 롤 각도 (허리의 좌우 기울기, -180도 ~ +180도)  
  Z: number; // 요 각도 (몸의 회전, -90도 ~ +90도)
}

/**
 * 가속도 데이터를 각도로 변환
 * 
 * 3축(X, Y, Z) 가속도 데이터를 각도(피치, 롤, 요)로 변환합니다.
 * 중력 가속도를 기준으로 각도를 계산하며, 칼만 필터를 적용하여 노이즈를 제거합니다.
 * 
 * 계산 원리:
 * - 피치(X축): atan2(ay, sqrt(ax² + az²)) - 목의 앞뒤 기울기
 * - 롤(Y축): atan2(-ax, az) - 허리의 좌우 기울기
 * - 요(Z축): atan2(az, sqrt(ax² + ay²)) - 몸의 회전 (근사값)
 * 
 * @param x X축 가속도 값 (일반적으로 -1 ~ +1 범위, 단위: g)
 * @param y Y축 가속도 값 (일반적으로 -1 ~ +1 범위, 단위: g)
 * @param z Z축 가속도 값 (일반적으로 0.5 ~ 1 범위, 단위: g, 중력 방향)
 * @returns 각도 데이터 객체 (X: 피치, Y: 롤, Z: 요, 단위: 도)
 */
export function accelerationToAngle(x: number, y: number, z: number): AngleResult {
  // 입력값 유효성 검사
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
    throw new Error('Invalid acceleration values: values must be finite numbers');
  }

  // 너무 작은 값들은 0으로 처리하여 계산 안정성 향상
  const threshold = 1e-6;
  const ax = Math.abs(x) < threshold ? 0 : x;
  const ay = Math.abs(y) < threshold ? 0 : y;
  const az = Math.abs(z) < threshold ? threshold : z; // z는 0이 되면 안 됨

  // X축 회전 각도 (피치) - 목의 앞뒤 기울기
  // 공식: atan2(ay, sqrt(ax² + az²))
  const pitchRad = Math.atan2(ay, Math.sqrt(ax * ax + az * az));
  const pitchDeg = pitchRad * (180 / Math.PI);
  
  // Y축 회전 각도 (롤) - 허리의 좌우 기울기
  // 공식: atan2(-ax, az)
  const rollRad = Math.atan2(-ax, az);
  const rollDeg = rollRad * (180 / Math.PI);
  
  // Z축 회전 각도 (요) - 몸의 회전
  // 가속도 센서만으로는 정확한 요 각도 계산이 어려우므로 근사값 사용
  // 공식: atan2(az, sqrt(ax² + ay²))
  const yawRad = Math.atan2(az, Math.sqrt(ax * ax + ay * ay));
  const yawDeg = yawRad * (180 / Math.PI);
  
  // 칼만 필터 적용하여 노이즈 제거
  const filteredAngles = kalmanFilter.updateAll({
    X: pitchDeg,
    Y: rollDeg,
    Z: yawDeg
  });
  
  // 결과를 소수점 2자리까지 반올림하여 반환
  return {
    X: Number(filteredAngles.X.toFixed(2)),
    Y: Number(filteredAngles.Y.toFixed(2)),
    Z: Number(filteredAngles.Z.toFixed(2))
  };
}

/**
 * 칼만 필터 파라미터 설정
 * 
 * 필터링 강도를 조절할 수 있습니다.
 * - processNoise가 작을수록: 더 부드러운 결과, 변화에 느리게 반응
 * - measurementNoise가 클수록: 측정값을 덜 신뢰, 더 안정적인 결과
 * 
 * @param processNoise 프로세스 노이즈 공분산 (권장값: 0.001 ~ 0.1)
 * @param measurementNoise 측정 노이즈 공분산 (권장값: 0.01 ~ 1.0)
 */
export function setFilterParameters(processNoise?: number, measurementNoise?: number): void {
  kalmanFilter.setParametersAll(processNoise, measurementNoise);
}

/**
 * 모든 칼만 필터 상태 초기화
 * 
 * 새로운 사용자나 새로운 센서 세션을 시작할 때 호출합니다.
 * 이전 데이터의 영향을 제거하고 깨끗한 상태에서 필터링을 시작합니다.
 */
export function resetFilters(): void {
  kalmanFilter.resetAll();
}

/**
 * 가속도 벡터의 크기 계산
 * 
 * 센서가 올바르게 작동하는지 확인하기 위해 사용할 수 있습니다.
 * 정상적인 중력 환경에서는 약 1g(9.8m/s²)가 되어야 합니다.
 * 
 * @param x X축 가속도
 * @param y Y축 가속도  
 * @param z Z축 가속도
 * @returns 가속도 벡터의 크기
 */
export function getAccelerationMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * 자세 안정성 평가
 * 
 * 연속된 각도 측정값들의 변화량을 분석하여 자세의 안정성을 평가합니다.
 * 값이 작을수록 안정적인 자세를 의미합니다.
 * 
 * @param previousAngle 이전 각도 측정값
 * @param currentAngle 현재 각도 측정값
 * @returns 자세 변화량 (0에 가까울수록 안정적)
 */
export function calculatePostureStability(
  previousAngle: AngleResult, 
  currentAngle: AngleResult
): number {
  const deltaX = Math.abs(currentAngle.X - previousAngle.X);
  const deltaY = Math.abs(currentAngle.Y - previousAngle.Y);
  const deltaZ = Math.abs(currentAngle.Z - previousAngle.Z);
  
  // 가중 평균으로 전체 변화량 계산 (목과 허리에 더 큰 가중치)
  return (deltaX * 0.4 + deltaY * 0.4 + deltaZ * 0.2);
}

/**
 * 각도 값을 사람이 읽기 쉬운 문자열로 변환
 * 
 * @param angle 각도 값
 * @returns 부호와 함께 포맷된 각도 문자열
 */
export function formatAngle(angle: number): string {
  const absAngle = Math.abs(angle);
  const sign = angle >= 0 ? '+' : '-';
  return `${sign}${absAngle.toFixed(1)}°`;
}

/**
 * 각도 데이터를 사람이 읽기 쉬운 형태로 변환
 * 
 * @param angleResult 각도 데이터 객체
 * @returns 포맷된 각도 정보 객체
 */
export function formatAngleResult(angleResult: AngleResult): {
  pitch: string;
  roll: string;
  yaw: string;
  summary: string;
} {
  return {
    pitch: `목 기울기: ${formatAngle(angleResult.X)}`,
    roll: `허리 기울기: ${formatAngle(angleResult.Y)}`,
    yaw: `몸 회전: ${formatAngle(angleResult.Z)}`,
    summary: `피치: ${formatAngle(angleResult.X)}, 롤: ${formatAngle(angleResult.Y)}, 요: ${formatAngle(angleResult.Z)}`
  };
}

/**
 * 각도 데이터가 정상 범위 내에 있는지 확인
 * 
 * @param angleResult 각도 데이터 객체
 * @returns 정상 범위 내 여부
 */
export function isAngleWithinNormalRange(angleResult: AngleResult): boolean {
  // 정상적인 자세 범위 (도 단위)
  const normalRanges = {
    X: { min: -30, max: 30 },  // 피치: -30도 ~ +30도
    Y: { min: -20, max: 20 },  // 롤: -20도 ~ +20도  
    Z: { min: -15, max: 15 }   // 요: -15도 ~ +15도
  };
  
  return (
    angleResult.X >= normalRanges.X.min && angleResult.X <= normalRanges.X.max &&
    angleResult.Y >= normalRanges.Y.min && angleResult.Y <= normalRanges.Y.max &&
    angleResult.Z >= normalRanges.Z.min && angleResult.Z <= normalRanges.Z.max
  );
}