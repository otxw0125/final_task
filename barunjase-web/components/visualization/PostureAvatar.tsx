'use client';

import React, { useRef, useEffect } from 'react';
import { CurrentPostureFeedback } from '../../app/api/feedback/current/route'; // API 타입 임포트

interface PostureAvatarProps {
  feedback: CurrentPostureFeedback['feedbackPerAxis'];
  width?: number;
  height?: number;
}

const PostureAvatar: React.FC<PostureAvatarProps> = ({ feedback, width = 200, height = 300 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getPartColor = (risk: 'safe' | 'warning' | 'danger' | 'unknown'): string => {
    switch (risk) {
      case 'safe': return '#4ade80'; // green-400
      case 'warning': return '#facc15'; // yellow-400
      case 'danger': return '#f87171'; // red-400
      default: return '#9ca3af'; // gray-400
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#F3F4F6'; // 밝은 회색 배경 (예: bg-gray-100)
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const avatarBottomMargin = 65; // 게이지 공간 확보
    const avatarHeight = canvas.height - avatarBottomMargin;
    
    // 사용자 정의 색상
    const chairColor = '#A1A1AA'; // zinc-400
    const safeColor = getPartColor('safe');
    const warningColor = getPartColor('warning');
    const dangerColor = getPartColor('danger');
    const unknownColor = getPartColor('unknown');
    const textColor = '#374151'; // gray-700

    // --- 각도 변환 ---
    const neckAngleRad = (feedback.x.angle || 0) * (Math.PI / 180); // X축: 상체 앞뒤
    const waistAngleRad = (feedback.y.angle || 0) * (Math.PI / 180); // Y축: 상체 좌우
    const torsoTwistAngle = feedback.z.angle || 0; // Z축: 몸통 비틀림 (회전 아이콘에 사용)

    // --- 실루엣 그리기 ---
    const chairSeatY = avatarHeight * 0.75;
    const chairSeatHeight = avatarHeight * 0.05;
    const chairBackHeight = avatarHeight * 0.4;
    const chairBackWidth = canvas.width * 0.5;
    const chairSeatWidth = canvas.width * 0.6;

    // 1. 의자 등받이
    ctx.fillStyle = chairColor;
    ctx.fillRect(centerX - chairBackWidth / 2, chairSeatY - chairBackHeight, chairBackWidth, chairBackHeight);
    
    // 2. 의자 좌석
    ctx.fillRect(centerX - chairSeatWidth / 2, chairSeatY, chairSeatWidth, chairSeatHeight);

    // 사용자 실루엣 크기
    const userTorsoHeight = avatarHeight * 0.35;
    const userTorsoWidth = canvas.width * 0.25;
    const userHeadRadius = avatarHeight * 0.1;
    
    // 상체 전체의 기준점 (좌석 바로 위 중앙)
    const upperBodyBaseX = centerX;
    const upperBodyBaseY = chairSeatY;

    // 3. 사용자 상체 (머리 + 몸통 통합, X/Y축 기울기 적용)
    ctx.save();
    // 상체의 회전 및 위치 기준점을 좌석 중앙 상단으로 이동
    ctx.translate(upperBodyBaseX, upperBodyBaseY);
    // Y축 회전 (좌우 기울기)
    ctx.rotate(waistAngleRad * 0.8); 

    // X축 기울기 (앞뒤 숙임/젖힘)에 따른 상체 세로 길이 변화 및 Y 오프셋
    // 앞으로 숙이면 (neckAngleRad > 0) 짧아지고, 뒤로 젖히면 (neckAngleRad < 0) 원래 길이 유지 또는 살짝 길어짐
    // Y 오프셋: 앞으로 숙이면 살짝 아래로, 뒤로 젖히면 살짝 위로
    let torsoEffectiveHeight = userTorsoHeight;
    let headEffectiveYOffset = -userTorsoHeight - userHeadRadius; // 머리가 몸통 바로 위에 오도록 기본 오프셋

    // X축 각도에 따른 시각적 효과 계수 (0 ~ 1, 0이면 변화 없음, 1이면 최대 변화)
    const xAngleEffectFactor = Math.sin(neckAngleRad) * 0.5; // 0.5는 변화 강도 조절

    torsoEffectiveHeight = userTorsoHeight * (1 - Math.abs(xAngleEffectFactor) * 0.6); // 앞/뒤 기울기 시 높이 살짝 줄임 (최대 30% 감소)
    headEffectiveYOffset -= userTorsoHeight * xAngleEffectFactor; // X축 기울기에 따라 머리 Y 위치 조정

    // 몸통 그리기 (Y축 회전 후 X축 영향 반영)
    // 몸통의 아랫부분을 기준점(0,0 - 즉 upperBodyBaseX, upperBodyBaseY)에 맞춤
    ctx.fillStyle = getPartColor(feedback.y.risk); // 몸통은 Y축 위험도 색상
    ctx.fillRect(
        -userTorsoWidth / 2, // 좌우 중앙 정렬
        -torsoEffectiveHeight,  // 위쪽으로 그림 (기준점이 하단 중앙이므로)
        userTorsoWidth, 
        torsoEffectiveHeight
    );

    // 머리 그리기 (변형된 몸통 위에)
    // 머리 중심은 몸통 상단 중앙에서 headEffectiveYOffset 만큼 떨어진 곳
    ctx.beginPath();
    ctx.arc(
        0, // 몸통과 X축 중심 동일
        headEffectiveYOffset + userHeadRadius, // 머리 Y 중심. 몸통 상단에서 반지름만큼 위로
        userHeadRadius, 
        0, 
        Math.PI * 2
    );
    ctx.fillStyle = getPartColor(feedback.x.risk); // 머리는 X축 위험도 색상
    ctx.fill();
    
    // 몸통 비틀림(Z축) 표시 - 몸통 중앙에 아이콘/텍스트
    // 몸통의 시각적 중심은 (0, -torsoEffectiveHeight / 2)
    ctx.fillStyle = textColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const zRiskColor = getPartColor(feedback.z.risk);
    const zArrow = torsoTwistAngle > 0 ? '↷' : '↶';
    const zIndicatorText = Math.abs(torsoTwistAngle) > 1 ? `${zArrow} ${Math.round(torsoTwistAngle)}°` : zArrow;
    
    if (Math.abs(torsoTwistAngle) > 0.5) {
        ctx.fillStyle = zRiskColor;
        ctx.fillText(zIndicatorText, 0, -torsoEffectiveHeight / 2);
    } else { // 비틀림이 거의 없을 때
        ctx.fillStyle = zRiskColor;
        ctx.beginPath();
        ctx.arc(0, -torsoEffectiveHeight / 2, 3, 0, Math.PI * 2); // 작은 원
        ctx.fill();
    }
    ctx.restore(); // 상체 변환 복원

    // --- 게이지 그리기 ---
    const gaugeAreaY = canvas.height - avatarBottomMargin + 10;
    const gaugeHeight = 15;
    const gaugeWidth = canvas.width * 0.7;
    const gaugeStartX = centerX - gaugeWidth / 2;
    const labelWidth = 35; // "X:", "Y:", "Z:" 라벨 공간
    const valueTextWidth = 40; // 각도 값 표시 공간

    const drawGauge = (
        yPos: number, 
        label: string, 
        value: number, 
        risk: 'safe' | 'warning' | 'danger' | 'unknown', 
        normalRange: { min: number, max: number }
    ) => {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 10, yPos + gaugeHeight / 2);

        // 게이지 배경 (정상 범위 표시)
        const rangeMin = Math.min(normalRange.min, normalRange.max);
        const rangeMax = Math.max(normalRange.min, normalRange.max);
        // 게이지 전체 범위는 -45 ~ 45 정도로 가정 (또는 normalRange를 훨씬 포함하는 범위)
        const visualMin = -45; 
        const visualMax = 45;
        const totalRange = visualMax - visualMin;

        // 정상 범위 바
        const normalStartPercent = (rangeMin - visualMin) / totalRange;
        const normalEndPercent = (rangeMax - visualMin) / totalRange;
        ctx.fillStyle = '#E5E7EB'; // gray-200
        ctx.fillRect(gaugeStartX, yPos, gaugeWidth, gaugeHeight);
        
        ctx.fillStyle = safeColor; // 정상 범위는 초록색
        ctx.fillRect(
            gaugeStartX + gaugeWidth * normalStartPercent, 
            yPos, 
            gaugeWidth * (normalEndPercent - normalStartPercent), 
            gaugeHeight
        );
        
        // 현재 값 포인터
        const valuePercent = Math.max(0, Math.min(1, (value - visualMin) / totalRange));
        const pointerX = gaugeStartX + gaugeWidth * valuePercent;
        
        ctx.fillStyle = getPartColor(risk);
        ctx.beginPath();
        ctx.moveTo(pointerX, yPos - 3);
        ctx.lineTo(pointerX - 3, yPos + gaugeHeight + 3);
        ctx.lineTo(pointerX + 3, yPos + gaugeHeight + 3);
        ctx.closePath();
        ctx.fill();

        // 값 텍스트
        ctx.fillStyle = getPartColor(risk);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(value)}°`, canvas.width - 10, yPos + gaugeHeight / 2);
    };

    drawGauge(gaugeAreaY, "앞뒤:", feedback.x.angle, feedback.x.risk, feedback.x.normalRange);
    drawGauge(gaugeAreaY + gaugeHeight + 5, "좌우:", feedback.y.angle, feedback.y.risk, feedback.y.normalRange);
    drawGauge(gaugeAreaY + (gaugeHeight + 5) * 2, "비틀림:", feedback.z.angle, feedback.z.risk, feedback.z.normalRange);

  }, [feedback, width, height]); // feedback, width, height 변경 시 다시 그리기

  return (
    <canvas ref={canvasRef} width={width} height={height} className="rounded-md shadow-inner" />
  );
};

export default PostureAvatar; 