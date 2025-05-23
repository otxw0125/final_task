/**
 * 다중 축 칼만 필터 구현
 * 
 * 가속도 센서 데이터와 같은 노이즈가 있는 측정값에서 더 정확한 상태 추정을 제공합니다.
 * 이 구현은 X, Y, Z 축에 대해 독립적인 칼만 필터를 적용합니다.
 */

// 단일 축 칼만 필터 클래스
class KalmanFilter {
  // 상태 변수
  private stateEstimate: number; // 현재 상태 추정값
  private errorCovariance: number; // 현재 오차 공분산
  
  // 칼만 필터 파라미터
  private processNoise: number; // 프로세스 노이즈 공분산 (Q)
  private measurementNoise: number; // 측정 노이즈 공분산 (R)

  /**
   * 칼만 필터 생성자
   * 
   * @param initialState 초기 상태 값 (기본값 0)
   * @param initialCovariance 초기 오차 공분산 (기본값 1)
   * @param processNoise 프로세스 노이즈 공분산 (기본값 0.01)
   * @param measurementNoise 측정 노이즈 공분산 (기본값 0.1)
   */
  constructor(
    initialState: number = 0,
    initialCovariance: number = 1, 
    processNoise: number = 0.01,
    measurementNoise: number = 0.1
  ) {
    this.stateEstimate = initialState;
    this.errorCovariance = initialCovariance;
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  /**
   * 칼만 필터 파라미터 설정
   * 
   * @param processNoise 프로세스 노이즈 공분산
   * @param measurementNoise 측정 노이즈 공분산
   */
  public setParameters(processNoise?: number, measurementNoise?: number): void {
    if (processNoise !== undefined) {
      this.processNoise = processNoise;
    }
    if (measurementNoise !== undefined) {
      this.measurementNoise = measurementNoise;
    }
  }

  /**
   * 칼만 필터 상태 리셋
   * 
   * @param initialState 초기 상태 값 (기본값 0)
   * @param initialCovariance 초기 오차 공분산 (기본값 1)
   */
  public reset(initialState: number = 0, initialCovariance: number = 1): void {
    this.stateEstimate = initialState;
    this.errorCovariance = initialCovariance;
  }

  /**
   * 칼만 필터 갱신
   * 
   * 새로운 측정값으로 필터를 갱신하고 필터링된 상태 추정값 반환
   * 
   * @param measurement 새로운 측정값
   * @returns 필터링된 상태 추정값
   */
  public update(measurement: number): number {
    // 예측 단계
    // 상태 예측 (이전 상태 그대로 사용, 단순 위치 모델)
    const predictedState = this.stateEstimate;
    
    // 오차 공분산 예측
    const predictedCovariance = this.errorCovariance + this.processNoise;
    
    // 갱신 단계
    // 칼만 이득 계산
    const kalmanGain = predictedCovariance / (predictedCovariance + this.measurementNoise);
    
    // 상태 추정값 갱신
    this.stateEstimate = predictedState + kalmanGain * (measurement - predictedState);
    
    // 오차 공분산 갱신
    this.errorCovariance = (1 - kalmanGain) * predictedCovariance;
    
    return this.stateEstimate;
  }

  /**
   * 현재 상태 추정값 반환
   */
  public getState(): number {
    return this.stateEstimate;
  }

  /**
   * 현재 오차 공분산 반환
   */
  public getCovariance(): number {
    return this.errorCovariance;
  }
}

// 다중 축 칼만 필터 인터페이스
type AxisData = { 
  [axis: string]: number 
};

/**
 * 다중 축 칼만 필터 클래스
 * 
 * 여러 축(X, Y, Z 등)에 대해 독립적인 칼만 필터를 적용합니다.
 */
export class MultiAxisKalmanFilter {
  private filters: { [axis: string]: KalmanFilter } = {};
  private axes: string[];

  /**
   * 다중 축 칼만 필터 생성자
   * 
   * @param axes 필터링할 축 목록 (예: ['X', 'Y', 'Z'])
   * @param processNoise 모든 축에 적용할 프로세스 노이즈 공분산
   * @param measurementNoise 모든 축에 적용할 측정 노이즈 공분산
   */
  constructor(
    axes: string[] = ['X', 'Y', 'Z'],
    processNoise: number = 0.01,
    measurementNoise: number = 0.1
  ) {
    this.axes = axes;
    
    // 각 축에 대한 칼만 필터 생성
    for (const axis of axes) {
      this.filters[axis] = new KalmanFilter(0, 1, processNoise, measurementNoise);
    }
  }

  /**
   * 모든 축의 칼만 필터 파라미터 설정
   * 
   * @param processNoise 프로세스 노이즈 공분산
   * @param measurementNoise 측정 노이즈 공분산
   */
  public setParametersAll(processNoise?: number, measurementNoise?: number): void {
    for (const axis in this.filters) {
      this.filters[axis].setParameters(processNoise, measurementNoise);
    }
  }

  /**
   * 특정 축의 칼만 필터 파라미터 설정
   * 
   * @param axis 설정할 축 이름
   * @param processNoise 프로세스 노이즈 공분산
   * @param measurementNoise 측정 노이즈 공분산
   */
  public setParameters(axis: string, processNoise?: number, measurementNoise?: number): void {
    if (this.filters[axis]) {
      this.filters[axis].setParameters(processNoise, measurementNoise);
    }
  }

  /**
   * 모든 축의 칼만 필터 상태 리셋
   */
  public resetAll(): void {
    for (const axis in this.filters) {
      this.filters[axis].reset();
    }
  }

  /**
   * 특정 축의 칼만 필터 상태 리셋
   * 
   * @param axis 리셋할 축 이름
   * @param initialState 초기 상태 값
   * @param initialCovariance 초기 오차 공분산
   */
  public reset(axis: string, initialState: number = 0, initialCovariance: number = 1): void {
    if (this.filters[axis]) {
      this.filters[axis].reset(initialState, initialCovariance);
    }
  }

  /**
   * 모든 축의 칼만 필터 갱신
   * 
   * @param measurements 각 축의 측정값 객체
   * @returns 각 축의 필터링된 상태 추정값 객체
   */
  public updateAll(measurements: AxisData): AxisData {
    const result: AxisData = {};
    
    for (const axis in measurements) {
      if (this.filters[axis]) {
        result[axis] = this.filters[axis].update(measurements[axis]);
      } else {
        // 해당 축의 필터가 없다면 필터 생성
        this.filters[axis] = new KalmanFilter(0, 1, 0.01, 0.1);
        result[axis] = this.filters[axis].update(measurements[axis]);
        
        // 새 축을 축 목록에 추가
        if (!this.axes.includes(axis)) {
          this.axes.push(axis);
        }
      }
    }
    
    return result;
  }

  /**
   * 특정 축의 칼만 필터 갱신
   * 
   * @param axis 갱신할 축 이름
   * @param measurement 측정값
   * @returns 필터링된 상태 추정값
   */
  public update(axis: string, measurement: number): number {
    if (!this.filters[axis]) {
      this.filters[axis] = new KalmanFilter(0, 1, 0.01, 0.1);
      
      // 새 축을 축 목록에 추가
      if (!this.axes.includes(axis)) {
        this.axes.push(axis);
      }
    }
    
    return this.filters[axis].update(measurement);
  }

  /**
   * 특정 축의 현재 상태 추정값 반환
   * 
   * @param axis 조회할 축 이름
   * @returns 상태 추정값 또는 축이 없을 경우 undefined
   */
  public getState(axis: string): number | undefined {
    return this.filters[axis]?.getState();
  }

  /**
   * 모든 축의 현재 상태 추정값 반환
   * 
   * @returns 각 축의 상태 추정값 객체
   */
  public getStateAll(): AxisData {
    const result: AxisData = {};
    
    for (const axis of this.axes) {
      result[axis] = this.filters[axis].getState();
    }
    
    return result;
  }

  /**
   * 필터링된 축 목록 반환
   * 
   * @returns 현재 관리 중인 축 이름 배열
   */
  public getAxes(): string[] {
    return [...this.axes];
  }
}
