//file lib/algorithms/angleConverter.ts
import { MultiAxisKalmanFilter } from './kalmanFilter';

/**
 * 가속도 센서 데이터를 각도로 변환하는 알고리즘 (앉은 자세 전용)
 * 
 * 이 모듈은 3축 가속도 센서 데이터를 받아서 앉은 자세의 기울기 각도로 변환합니다:
 * - X축 각도: 앉은 자세의 좌우 기울기 (목과 어깨의 좌우 기울어짐)
 * - Y축 각도: 앉은 자세의 상하 기울기 (허리의 상하 기울어짐) - 허리에 부담
 * 
 * 칼만 필터를 적용하여 센서 노이즈를 제거하고 안정적인 각도 값을 제공합니다.
 */

// 전역 칼만 필터 인스턴스 (X, Y 축에 대해 각각 독립적으로 필터링)
const kalmanFilter = new MultiAxisKalmanFilter(
  ['X', 'Y'],
  0.01,  // 프로세스 노이즈 (작을수록 더 부드러운 결과)
  0.1    // 측정 노이즈 (클수록 측정값을 덜 신뢰)
);

/**
 * 각도 변환 결과 인터페이스 (앉은 자세용)
 */
export interface AngleResult {
  X: number; // 좌우 기울기 (목과 어깨의 좌우 기울어짐, -90도 ~ +90도)
  Y: number; // 상하 기울기 (허리의 상하 기울어짐, -90도 ~ +90도) - 허리에 부담
}

/**
 * 가속도 데이터를 앉은 자세의 기울기 각도로 변환
 * 
 * 3축(X, Y, Z) 가속도 데이터를 앉은 자세의 기울기 각도로 변환합니다.
 * 센서가 등에 부착되어 있다는 가정하에 계산됩니다.
 * 
 * 계산 원리 (센서가 등에 부착된 앉은 자세 기준):
 * - 정상 자세: Z축이 중력 방향(음수), X, Y축은 0에 가까움
 * - X축 (좌우 기울기): 좌우로 기울어질 때 X축 변화를 기반으로 계산
 * - Y축 (상하 기울기): 상하로 기울어질 때 Y축 변화를 기반으로 계산 - 허리에 부담
 * 
 * @param x X축 가속도 값 (좌우 방향, 단위: g)
 * @param y Y축 가속도 값 (상하 방향, 단위: g) 
 * @param z Z축 가속도 값 (상하 방향, 단위: g)
 * @returns 각도 데이터 객체 (X: 좌우 기울기, Y: 상하 기울기, 단위: 도)
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
  const az = Math.abs(z) < threshold ? (z < 0 ? -threshold : threshold) : z;

  // 센서가 등에 부착된 경우의 각도 계산
  // 일반적으로 정상 자세에서 Z축은 -1g에 가까움 (중력 반대 방향)
  
  // X축 기울기 (좌우) 계산
  // atan2를 사용하되, Z축이 주요 기준축이 되도록 계산 (센서의 X축 값을 사용)
  let leftRightRad = Math.atan2(ax, Math.abs(az));
  let leftRightDeg = leftRightRad * (180 / Math.PI);
  
  // Y축 기울기 (상하) 계산 - 허리에 부담이 가는 축
  // atan2를 사용하여 상하 기울기 계산 (센서의 Y축 값을 사용)
  let upDownRad = Math.atan2(ay, Math.abs(az));
  let upDownDeg = upDownRad * (180 / Math.PI);

  // Z축 방향에 따른 보정
  // Z축이 양수면 센서가 뒤집혀 있는 상태 (매우 많이 기울어진 경우)
  if (az > 0) {
    // 180도 보정 적용
    leftRightDeg = leftRightDeg > 0 ? 180 - leftRightDeg : -180 - leftRightDeg;
    upDownDeg = upDownDeg > 0 ? 180 - upDownDeg : -180 - upDownDeg;
  }

  // 각도 범위를 현실적인 앉은 자세 범위로 제한
  // 정상적인 앉은 자세에서는 ±45도를 넘지 않도록 제한
  leftRightDeg = Math.max(-45, Math.min(45, leftRightDeg));
  upDownDeg = Math.max(-45, Math.min(45, upDownDeg));
  
  // 추가적인 스케일링: 센서 민감도 조정
  // 실제 자세 변화보다 센서 값이 과도하게 클 수 있으므로 스케일 다운
  const scaleFactor = 0.7; // 30% 감소하여 더 현실적인 값으로 조정
  leftRightDeg *= scaleFactor;
  upDownDeg *= scaleFactor;
  
  // 칼만 필터 적용하여 노이즈 제거
  const filteredAngles = kalmanFilter.updateAll({
    X: leftRightDeg,  // X축: 좌우 기울기
    Y: upDownDeg      // Y축: 상하 기울기 (허리에 부담)
  });
  
  // 결과를 소수점 1자리까지 반올림하여 반환
  return {
    X: Number(filteredAngles.X.toFixed(1)), // 좌우 기울기
    Y: Number(filteredAngles.Y.toFixed(1))  // 상하 기울기 (허리)
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
 * 자세 안정성 평가 (앉은 자세용)
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
  
  // 좌우와 앞뒤 기울기에 동일한 가중치 적용
  return (deltaX * 0.5 + deltaY * 0.5);
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
 * 각도 데이터를 사람이 읽기 쉬운 형태로 변환 (앉은 자세용)
 * 
 * @param angleResult 각도 데이터 객체
 * @returns 포맷된 각도 정보 객체
 */
export function formatAngleResult(angleResult: AngleResult): {
  leftRight: string;
  frontBack: string;
  summary: string;
} {
  return {
    leftRight: `좌우 기울기: ${formatAngle(angleResult.X)}`,
    frontBack: `상하 기울기: ${formatAngle(angleResult.Y)}`,
    summary: `좌우: ${formatAngle(angleResult.X)}, 상하: ${formatAngle(angleResult.Y)}`
  };
}

/**
 * 각도 데이터가 정상 범위 내에 있는지 확인 (앉은 자세용)
 * 
 * @param angleResult 각도 데이터 객체
 * @returns 정상 범위 내 여부
 */
export function isAngleWithinNormalRange(angleResult: AngleResult): boolean {
  // 앉은 자세의 정상적인 기울기 범위 (도 단위)
  const normalRanges = {
    X: { min: -15, max: 15 },  // 좌우: -15도 ~ +15도 (목과 어깨의 좌우 기울어짐)
    Y: { min: -20, max: 20 }   // 상하: -20도 ~ +20도 (허리의 상하 기울어짐) - 허리에 부담
  };
  
  return (
    angleResult.X >= normalRanges.X.min && angleResult.X <= normalRanges.X.max &&
    angleResult.Y >= normalRanges.Y.min && angleResult.Y <= normalRanges.Y.max
  );
}