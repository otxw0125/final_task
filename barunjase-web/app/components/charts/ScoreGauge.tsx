import React from 'react';

/**
 * 자세 점수 게이지 컴포넌트 속성
 */
interface ScoreGaugeProps {
  score: number;
  size?: number;
  thickness?: number;
  label?: string;
}

/**
 * 자세 점수를 시각적으로 표시하는 게이지 차트 컴포넌트
 * 
 * 0-100 사이의 점수를 원형 게이지로 표시합니다.
 */
const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  size = 200,
  thickness = 12,
  label = '자세 점수'
}) => {
  // 0-100 사이의 값으로 제한
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  // 점수에 따라 색상 결정
  const getColor = (score: number) => {
    if (score >= 80) return '#34D399'; // 녹색 (좋음)
    if (score >= 60) return '#FBBF24'; // 노란색 (보통)
    return '#EF4444';                  // 빨간색 (나쁨)
  };
  
  // SVG 파라미터 계산
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - normalizedScore / 100);
  const color = getColor(normalizedScore);
  
  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size, position: 'relative' }}>
        {/* 배경 원 */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={thickness}
          />
        </svg>
        
        {/* 점수 표시 원 */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        
        {/* 중앙 점수 텍스트 */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div className="text-gray-500 text-sm">{label}</div>
          <div className="text-4xl font-bold" style={{ color }}>
            {normalizedScore}
          </div>
          <div className="text-gray-400 text-sm">/ 100</div>
        </div>
      </div>
    </div>
  );
};

export default ScoreGauge; 