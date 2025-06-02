import { RawSensorValues } from "@/lib/models/RawSensorData";
import { AnglesValues } from "@/lib/models/AngleData";

// 기본 각도 상태 (정상 자세)
const BASE_ROLL = -4.29; // degrees (기본 Roll 각도)
const BASE_PITCH = 68.97; // degrees (기본 Pitch 각도)

/**
 * 가속도 센서 값 (x, y, z 가속도)을 각 축의 기울기 각도 값으로 변환합니다.
 * 기본 각도와의 차이(변화량)를 계산하여 자세 변화를 측정합니다.
 * 
 * - X축 기울기 (Pitch): Gx와 YZ 평면 사이의 각도 (atan2(Gx, sqrt(Gy² + Gz²)))
 * - Y축 기울기 (Roll): Gy와 XZ 평면 사이의 각도 (atan2(Gy, sqrt(Gx² + Gz²)))
 * - Z축: 사용하지 않음 (항상 0 반환)
 *
 * 반환되는 각도는 기본 각도와의 차이(변화량)를 나타냅니다.
 *
 * @param accelValues x_accel, y_accel, z_accel을 포함하는 객체
 * @returns x, y 변화량과 z=0을 포함하는 객체 (AnglesValues 타입)
 */
export function convertAccelToAngles(accelValues: RawSensorValues): AnglesValues {
  // 입력 검증
  if (!accelValues) {
    console.error("[convertAccelToAngles] accelValues is null or undefined");
    return { x: 0, y: 0, z: 0 };
  }

  const { x_accel, y_accel, z_accel } = accelValues;

  // 개별 값 검증
  if (typeof x_accel !== 'number' || typeof y_accel !== 'number' || typeof z_accel !== 'number') {
    console.error("[convertAccelToAngles] Invalid acceleration values:", { x_accel, y_accel, z_accel });
    return { x: 0, y: 0, z: 0 };
  }

  if (x_accel === 0 && y_accel === 0 && z_accel === 0) {
    console.warn("[convertAccelToAngles] All accelerometer values are zero. Returning zero angles.");
    return { x: 0, y: 0, z: 0 };
  }

  // X축 기울기 (Pitch): Gx와 YZ 평면 사이의 각도
  const pitch_rad = Math.atan2(x_accel, Math.sqrt(y_accel * y_accel + z_accel * z_accel));
  const pitch_deg = pitch_rad * (180 / Math.PI);

  // Y축 기울기 (Roll): Gy와 XZ 평면 사이의 각도
  const roll_rad = Math.atan2(y_accel, Math.sqrt(x_accel * x_accel + z_accel * z_accel));
  const roll_deg = roll_rad * (180 / Math.PI);

  // 기본 각도와의 차이 계산 (변화량)
  const pitch_deviation = pitch_deg - BASE_PITCH;
  const roll_deviation = roll_deg - BASE_ROLL;

  // Z축은 사용하지 않으므로 항상 0
  const z_deviation = 0;

  return {
    x: parseFloat(pitch_deviation.toFixed(2)), // Pitch 변화량
    y: parseFloat(roll_deviation.toFixed(2)),  // Roll 변화량
    z: parseFloat(z_deviation.toFixed(2)),     // 사용 안함 (0)
  };
} 