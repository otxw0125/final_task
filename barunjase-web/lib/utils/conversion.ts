import { RawSensorValues } from "@/lib/models/RawSensorData";
import { AnglesValues } from "@/lib/models/AngleData";

/**
 * 가속도 센서 값 (x, y, z 가속도)을 각 축의 기울기 각도 값으로 변환합니다.
 * 
 * - X축 기울기: Gx와 YZ 평면 사이의 각도. (atan2(Gx, sqrt(Gy² + Gz²)))
 * - Y축 기울기: Gy와 XZ 평면 사이의 각도. (atan2(Gy, sqrt(Gx² + Gz²)))
 * - Z축 기울기: 센서의 Z축이 실제 수직(중력) 방향으로부터 얼마나 기울어졌는지 나타내는 각도. (acos(Gz / G_total))
 *
 * 참고: 이 변환은 실제 센서의 축 방향, 설치 상태 및 원하는 각도의 정확한 정의에 따라
 * 추가적인 보정, 부호 조정, 공식 수정이 필요할 수 있습니다.
 *
 * @param accelValues x_accel, y_accel, z_accel을 포함하는 객체
 * @returns x, y, z 각도를 포함하는 객체 (AnglesValues 타입)
 */
export function convertAccelToAngles(accelValues: RawSensorValues): AnglesValues {
  const { x_accel, y_accel, z_accel } = accelValues;

  if (x_accel === 0 && y_accel === 0 && z_accel === 0) {
    console.warn("[convertAccelToAngles] All accelerometer values are zero. Returning zero angles.");
    return { x: 0, y: 0, z: 0 };
  }

  // X축 기울기: Gx와 YZ 평면 사이의 각도 (Pitch와 유사 역할 가능)
  const angle_x_rad = Math.atan2(x_accel, Math.sqrt(y_accel * y_accel + z_accel * z_accel));
  const angle_x_deg = angle_x_rad * (180 / Math.PI);

  // Y축 기울기: Gy와 XZ 평면 사이의 각도 (Roll과 유사 역할 가능)
  const angle_y_rad = Math.atan2(y_accel, Math.sqrt(x_accel * x_accel + z_accel * z_accel));
  const angle_y_deg = angle_y_rad * (180 / Math.PI);

  // Z축 기울기: 센서의 Z축이 실제 수직(중력) 방향으로부터 얼마나 기울어졌는지 나타내는 각도.
  // G_total (총 가속도 크기) 계산
  const g_total = Math.sqrt(x_accel * x_accel + y_accel * y_accel + z_accel * z_accel);
  let angle_z_deg = 0;
  if (g_total > 0) { // 0으로 나누는 것을 방지
    // Gz / G_total 값은 -1과 1 사이여야 함. 클램핑으로 acos 입력 오류 방지.
    const cos_theta_z = Math.max(-1, Math.min(1, z_accel / g_total));
    const angle_z_rad = Math.acos(cos_theta_z);
    angle_z_deg = angle_z_rad * (180 / Math.PI);
  } else {
    // G_total이 0인 경우는 위에서 이미 처리되었어야 하나, 방어적으로 0으로 설정
    console.warn("[convertAccelToAngles] G_total is zero, should not happen if individual accels are non-zero. Setting Z angle to 0.");
  }
  
  // AngleData의 z 각도는 일반적으로 수평면에서의 회전(Yaw)을 의미하거나, 
  // 또는 특정 기준으로부터의 작은 각도 변화를 의미할 수 있음.
  // 여기서 계산된 angle_z_deg는 '수직으로부터의 Z축 기울기' (0도~180도).
  // 이것이 AngleData.z에 직접 사용될 수 있는지, 아니면 추가 변환이 필요한지 확인 필요.
  // 예를 들어, 0도가 '완벽히 수직'을 의미하도록.
  // 만약 센서 Z축이 위를 향할 때 0도, 아래를 향할 때 180도가 되도록 하려면 이대로 사용.
  // 만약 항상 양수 기울기 (0~90도)를 원한다면 추가 조정 필요. (예: 90 - abs(90 - angle_z_deg))

  return {
    x: parseFloat(angle_x_deg.toFixed(2)),
    y: parseFloat(angle_y_deg.toFixed(2)),
    z: parseFloat(angle_z_deg.toFixed(2)), // 계산된 Z축 기울기 사용
  };
} 