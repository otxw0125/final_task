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
    ctx.fillStyle = '#F3F4F6'; // 밝은 회색 배경
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const avatarBottomMargin = 50; // 게이지 공간 확보
    const avatarHeight = canvas.height - avatarBottomMargin;
    
    // 색상 정의
    const chairColor = '#A1A1AA'; // zinc-400
    const textColor = '#374151'; // gray-700
    const skinColor = '#fbbf24'; // amber-400

    // 각도 변환 (앉은 자세용 - 시각적으로 완화)
    const frontBackAngleRad = (feedback.x?.angle || 0) * (Math.PI / 180) * 0.3; // X축: 앞뒤 기울기, 30%로 완화
    const leftRightAngleRad = (feedback.y?.angle || 0) * (Math.PI / 180) * 0.4; // Y축: 좌우 기울기, 40%로 완화

    // 의자 크기 정의
    const chairSeatY = avatarHeight * 0.75;
    const chairSeatHeight = avatarHeight * 0.05;
    const chairBackHeight = avatarHeight * 0.4;
    const chairBackWidth = avatarHeight * 0.08;
    const chairSeatWidth = avatarHeight * 0.35;

    // 1. 의자 등받이 (왼쪽에 위치 - 더 자연스러운 자세)
    ctx.fillStyle = chairColor;
    ctx.fillRect(
      centerX - chairSeatWidth * 0.5, 
      chairSeatY - chairBackHeight, 
      chairBackWidth, 
      chairBackHeight + chairSeatHeight
    );
    
    // 2. 의자 좌석
    ctx.fillRect(
      centerX - chairSeatWidth / 2, 
      chairSeatY, 
      chairSeatWidth, 
      chairSeatHeight
    );

    // 3. 의자 팔걸이 (선택적)
    ctx.fillRect(
      centerX - chairSeatWidth / 2, 
      chairSeatY - avatarHeight * 0.1, 
      chairBackWidth * 0.6, 
      avatarHeight * 0.15
    );
    ctx.fillRect(
      centerX + chairSeatWidth / 2 - chairBackWidth * 0.6, 
      chairSeatY - avatarHeight * 0.1, 
      chairBackWidth * 0.6, 
      avatarHeight * 0.15
    );

    // 사용자 몸체 크기 정의
    const headRadius = avatarHeight * 0.06;
    const neckWidth = avatarHeight * 0.04;
    const neckHeight = avatarHeight * 0.08;
    const shoulderWidth = avatarHeight * 0.08; // 측면 관점에 맞게 어깨 너비 대폭 축소
    const shoulderHeight = avatarHeight * 0.12; // 어깨 높이 증가로 측면 두께감 표현
    const upperTorsoHeight = avatarHeight * 0.15;
    const lowerTorsoHeight = avatarHeight * 0.12;
    const torsoWidth = avatarHeight * 0.14;
    const hipWidth = avatarHeight * 0.16;
    const hipHeight = avatarHeight * 0.08;
    const thighHeight = avatarHeight * 0.18;

    // 기준점: 엉덩이 중심 (좌석 위)
    const hipCenterX = centerX;
    const hipCenterY = chairSeatY;

    // 4. 하체 그리기 (고정)
    // 엉덩이
    ctx.fillStyle = getPartColor('safe'); // 하체는 항상 안전 색상
    ctx.fillRect(
      hipCenterX - hipWidth / 2,
      hipCenterY - hipHeight,
      hipWidth,
      hipHeight
    );

    // 5. 상체 그리기 (기울기 적용)
    ctx.save();
    ctx.translate(hipCenterX, hipCenterY - hipHeight); // 엉덩이 상단을 기준점으로
    
    // X축 기울기 (앞뒤) - 앞으로 기울어지면 시계방향 회전
    ctx.rotate(frontBackAngleRad);
    
    // Y축 기울기 (좌우) - 좌우로 기울어지는 효과를 X축 이동으로 표현
    const lateralOffset = Math.sin(leftRightAngleRad) * 8; // 좌우 기울기를 더 부드럽게 표현
    ctx.translate(lateralOffset, 0);

    // 하부 몸통 (허리 부분)
    ctx.fillStyle = getPartColor(feedback.x?.risk || 'unknown'); // X축(앞뒤) 위험도 색상 - 허리에 부담
    ctx.fillRect(
      -torsoWidth / 2,
      -lowerTorsoHeight,
      torsoWidth,
      lowerTorsoHeight
    );

    // 상부 몸통 (가슴 부분)
    ctx.fillStyle = getPartColor(feedback.x?.risk || 'unknown'); // X축(앞뒤) 위험도 색상 - 허리에 부담
    ctx.fillRect(
      -torsoWidth / 2,
      -lowerTorsoHeight - upperTorsoHeight,
      torsoWidth,
      upperTorsoHeight
    );

    // 어깨
    ctx.fillStyle = getPartColor(feedback.y?.risk || 'unknown'); // Y축(좌우) 위험도 색상
    ctx.fillRect(
      -shoulderWidth / 2,
      -lowerTorsoHeight - upperTorsoHeight - shoulderHeight / 2,
      shoulderWidth,
      shoulderHeight
    );

    // 목 그리기 (Y축 기울기에 더 민감하게 반응하지만 완화)
    ctx.save();
    ctx.translate(0, -lowerTorsoHeight - upperTorsoHeight - shoulderHeight / 2);
    ctx.rotate(leftRightAngleRad * 0.5); // 목 기울기를 더 완화
    
    ctx.fillStyle = getPartColor(feedback.y?.risk || 'unknown'); // Y축(좌우) 위험도 색상
    ctx.fillRect(
      -neckWidth / 2,
      -neckHeight,
      neckWidth,
      neckHeight
    );

    // 머리 그리기
    ctx.beginPath();
    ctx.arc(
      0,
      -neckHeight - headRadius,
      headRadius,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = skinColor; // 머리는 피부색으로
    ctx.fill();
    
    ctx.restore(); // 목 회전 복원
    ctx.restore(); // 상체 변환 복원

    // 6. 기울기 정도 시각적 표시
    // 좌우 기울기 표시선 (수직선) - 더 큰 각도에서만 표시
    if (Math.abs(feedback.y?.angle || 0) > 10) { // 10도 이상일 때만 표시
      ctx.strokeStyle = getPartColor(feedback.y?.risk || 'unknown'); // Y축(좌우) 위험도 색상
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(centerX, avatarHeight * 0.1);
      ctx.lineTo(centerX + Math.sin((feedback.y?.angle || 0) * Math.PI / 180) * 15, avatarHeight * 0.9);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 앞뒤 기울기 표시 호 (상체 주변) - 더 큰 각도에서만 표시
    if (Math.abs(feedback.x?.angle || 0) > 15) { // 15도 이상일 때만 표시
      ctx.strokeStyle = getPartColor(feedback.x?.risk || 'unknown'); // X축(앞뒤) 위험도 색상
      ctx.lineWidth = 2;
      ctx.beginPath();
      const arcRadius = 45;
      const visualAngle = (feedback.x?.angle || 0) * 0.3; // 시각적 각도 완화
      const startAngle = -Math.PI / 6;
      const endAngle = startAngle + (visualAngle * Math.PI / 180);
      ctx.arc(centerX, chairSeatY - hipHeight * 2, arcRadius, startAngle, endAngle);
      ctx.stroke();
      
      // 화살표 표시
      ctx.fillStyle = getPartColor(feedback.x?.risk || 'unknown'); // X축(앞뒤) 위험도 색상
      const arrowX = centerX + Math.cos(endAngle) * arcRadius;
      const arrowY = chairSeatY - hipHeight * 2 + Math.sin(endAngle) * arcRadius;
      ctx.beginPath();
      ctx.arc(arrowX, arrowY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- 게이지 그리기 ---
    const gaugeAreaY = canvas.height - avatarBottomMargin + 10;
    const gaugeHeight = 12;
    const gaugeWidth = canvas.width * 0.8;
    const gaugeStartX = centerX - gaugeWidth / 2;

    const drawGauge = (
      yPos: number,
      label: string,
      value: number,
      risk: 'safe' | 'warning' | 'danger' | 'unknown',
      normalRange: { min: number, max: number }
    ) => {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 5, yPos + gaugeHeight / 2);

      // 게이지 배경
      const visualMin = -60;
      const visualMax = 60;
      const totalRange = visualMax - visualMin;

      // 전체 게이지 배경
      ctx.fillStyle = '#E5E7EB'; // gray-200
      ctx.fillRect(gaugeStartX, yPos, gaugeWidth, gaugeHeight);

      // 정상 범위 표시
      const normalStartPercent = (normalRange.min - visualMin) / totalRange;
      const normalEndPercent = (normalRange.max - visualMin) / totalRange;
      ctx.fillStyle = '#4ade80'; // green-400 (정상 범위)
      ctx.fillRect(
        gaugeStartX + gaugeWidth * Math.max(0, normalStartPercent),
        yPos,
        gaugeWidth * Math.max(0, Math.min(1, normalEndPercent - normalStartPercent)),
        gaugeHeight
      );

      // 현재 값 포인터
      const valuePercent = Math.max(0, Math.min(1, (value - visualMin) / totalRange));
      const pointerX = gaugeStartX + gaugeWidth * valuePercent;

      ctx.fillStyle = getPartColor(risk);
      ctx.beginPath();
      ctx.moveTo(pointerX, yPos - 2);
      ctx.lineTo(pointerX - 3, yPos + gaugeHeight + 2);
      ctx.lineTo(pointerX + 3, yPos + gaugeHeight + 2);
      ctx.closePath();
      ctx.fill();

      // 값 텍스트
      ctx.fillStyle = getPartColor(risk);
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(value)}°`, canvas.width - 5, yPos + gaugeHeight / 2);
    };

    // X, Y축만 표시
    drawGauge(
      gaugeAreaY,
      "앞뒤:",
      feedback.x?.angle || 0,
      feedback.x?.risk || 'unknown',
      feedback.x?.normalRange || { min: -20, max: 20 }
    );
    
    drawGauge(
      gaugeAreaY + gaugeHeight + 5,
      "좌우:",
      feedback.y?.angle || 0,
      feedback.y?.risk || 'unknown',
      feedback.y?.normalRange || { min: -15, max: 15 }
    );

  }, [feedback]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 rounded-md"
      style={{ backgroundColor: '#F3F4F6' }}
    />
  );
};

export default PostureAvatar; 