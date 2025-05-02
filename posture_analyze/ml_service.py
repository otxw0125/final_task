from flask import Flask, request, jsonify
import numpy as np
import math

app = Flask(__name__)

# --- 자세 분석 로직 (단순 예시: 기울기 계산 및 임계값 기반 분류) ---

def calculate_angles(x, y, z):
    """가속도 데이터로부터 Roll, Pitch 각도 추정 (단순화된 방식)"""
    # 참고: 이 계산은 센서의 축 방향 및 부착 위치에 따라 달라질 수 있습니다.
    # 실제로는 자이로 데이터와 융합(예: 칼만 필터)해야 더 안정적입니다.
    try:
        # Pitch (X축 기준 회전 - 앞뒤 기울기)
        # Z축이 중력 방향(-9.8)일 때 기준
        pitch = math.atan2(-x, math.sqrt(y**2 + z**2)) * 180 / math.pi

        # Roll (Y축 기준 회전 - 좌우 기울기)
        # Z축이 - 라면 atan2(y, -z) 또는 atan2(y, abs(z)) 등을 고려
        roll = math.atan2(y, z) * 180 / math.pi
        # 만약 Z가 거의 0이면 불안정해질 수 있음 (예: 수평 상태)
        # if abs(z) < 0.1: roll = 0 # 예외 처리

        return pitch, roll
    except Exception as e:
        print(f"Angle calculation error: {e}")
        return None, None

def analyze_posture_simple(sensor_data_window):
    """
    센서 데이터 시퀀스를 받아 간단한 규칙 기반으로 자세 분석
    :param sensor_data_window: [{'accel': {'x': ..., 'y': ..., 'z': ...}}, ...] 형태의 리스트
    :return: 분석 결과 문자열 (예: "안정", "주의: 앞으로 기울어짐", "경고: 왼쪽으로 기울어짐")
    """
    if not sensor_data_window:
        return "데이터 부족"

    pitches = []
    rolls = []

    for data_point in sensor_data_window:
        if 'accel' in data_point:
            x = data_point['accel'].get('x')
            y = data_point['accel'].get('y')
            z = data_point['accel'].get('z')
            if x is not None and y is not None and z is not None:
                pitch, roll = calculate_angles(x, y, z)
                if pitch is not None and roll is not None:
                    pitches.append(pitch)
                    rolls.append(roll)

    if not pitches or not rolls:
        return "각도 계산 불가"

    # 시간 윈도우 동안의 평균 각도 계산
    avg_pitch = np.mean(pitches)
    avg_roll = np.mean(rolls)

    print(f"Average Pitch: {avg_pitch:.2f}, Average Roll: {avg_roll:.2f}") # 디버깅용 로그

    # --- 임계값 기반 자세 분류 (매우 단순한 예시) ---
    # 이 임계값은 센서 위치, 사용자, 의자 등에 따라 크게 달라지므로 반드시 조정 및 검증 필요!
    pitch_threshold_low = -15 # 예: 등이 너무 뒤로 젖혀짐
    pitch_threshold_high = 25  # 예: 등이 앞으로 구부정함 (거북목 경향)
    roll_threshold = 15       # 예: 좌우 기울어짐

    posture_status = "안정"
    issues = []

    if avg_pitch > pitch_threshold_high:
        issues.append("앞으로 구부정함")
        posture_status = "경고!"
    elif avg_pitch < pitch_threshold_low:
         issues.append("뒤로 젖혀짐")
         posture_status = "주의"


    if abs(avg_roll) > roll_threshold:
        if avg_roll > 0:
             issues.append("오른쪽으로 기울어짐")
        else:
             issues.append("왼쪽으로 기울어짐")
        posture_status = "경고!" if posture_status != "경고!" else posture_status # 경고 유지 또는 승격

    if not issues:
        return f"안정 (Pitch: {avg_pitch:.1f}°, Roll: {avg_roll:.1f}°)"
    else:
        return f"{posture_status} ({', '.join(issues)} / Pitch: {avg_pitch:.1f}°, Roll: {avg_roll:.1f}°)"


# --- Flask API 엔드포인트 ---

@app.route('/predict', methods=['POST'])
def predict_posture():
    """
    Node.js 로부터 센서 데이터 시퀀스를 받아 자세 분석 후 결과 반환
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid input: No data provided"}), 400

        user_id = data.get('userId')
        sensor_data = data.get('sensorData') # [{'accel': {x,y,z}, 'timestamp':...}, ...] 형태 기대

        if not user_id or not sensor_data or not isinstance(sensor_data, list):
            return jsonify({"error": "Invalid input: userId and sensorData list are required"}), 400

        # 분석 수행 (위에서 정의한 단순 분석 함수 사용)
        analysis_result = analyze_posture_simple(sensor_data)

        # 결과 반환
        return jsonify({
            "userId": user_id,
            "analysis": analysis_result,
            # 필요시 추가 정보 (예: 평균 각도) 포함 가능
            # "avg_pitch": avg_pitch,
            # "avg_roll": avg_roll
        })

    except Exception as e:
        print(f"Error during prediction: {e}")
        return jsonify({"error": "An internal error occurred"}), 500

if __name__ == '__main__':
    # 개발 목적으로 0.0.0.0 사용 시 외부 네트워크에서 접근 가능 (보안 주의)
    # Node.js 서버와 같은 머신에서 실행 시 localhost(127.0.0.1) 사용 가능
    app.run(host='0.0.0.0', port=5000, debug=True) # debug=True는 개발 중에만 사용