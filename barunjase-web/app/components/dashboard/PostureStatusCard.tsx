import { FC } from 'react';
import ScoreGauge from '../charts/ScoreGauge';
import PostureAvatar from '../posture/PostureAvatar';

/**
 * 자세 상태 데이터 인터페이스
 */
interface PostureStatus {
  score: number;
  angles: {
    X: number;
    Y: number;
    Z: number;
  };
  category?: string;
  lastUpdated?: string;
}

/**
 * 자세 상태 카드 컴포넌트 속성
 */
interface PostureStatusCardProps {
  data: PostureStatus;
  isLoading?: boolean;
}

/**
 * 현재 자세 상태를 표시하는 카드 컴포넌트
 * 
 * 자세 점수와 아바타를 함께 표시합니다.
 */
const PostureStatusCard: FC<PostureStatusCardProps> = ({ 
  data,
  isLoading = false
}) => {
  // 상태 카테고리에 따른 메시지 및 스타일 설정
  const getCategoryInfo = (score: number) => {
    if (score >= 80) {
      return { 
        message: '바른 자세입니다', 
        color: 'text-green-500',
        advice: '현재 자세를 유지하세요.'
      };
    }
    if (score >= 60) {
      return { 
        message: '적절한 자세입니다', 
        color: 'text-yellow-500',
        advice: '목과 허리의 각도를 조금 더 바르게 유지하세요.'
      };
    }
    return { 
      message: '자세가 올바르지 않습니다', 
      color: 'text-red-500',
      advice: '허리를 펴고 모니터 높이를 조정해 보세요.'
    };
  };
  
  const { message, color, advice } = getCategoryInfo(data.score);
  const formattedDate = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '업데이트 중...';
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6" data-testid="posture-status-card-e2e">
      {isLoading ? (
        <div className="flex items-center justify-center h-60" data-testid="posture-status-loading">
          <div className="animate-pulse text-gray-400">데이터 로딩 중...</div>
        </div>
      ) : (
        <>
          <h3 className="text-lg font-semibold mb-4">현재 자세 상태</h3>
          <div className="flex flex-col lg:flex-row items-center">
            <div className="flex-1 mb-6 lg:mb-0" data-testid="score-section">
              <ScoreGauge 
                score={data.score} 
                size={160}
                thickness={10}
                label="자세 점수"
              />
              
              <div className="mt-4 text-center">
                <p className={`font-semibold ${color}`} data-testid="posture-message">{message}</p>
                <p className="text-sm text-gray-500 mt-1" data-testid="posture-advice">{advice}</p>
              </div>
            </div>
            
            <div className="flex-1 flex justify-center" data-testid="avatar-section">
              <PostureAvatar
                angles={data.angles}
                width={220}
                height={300}
              />
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500 text-right" data-testid="last-updated-time">
            마지막 업데이트: {formattedDate}
          </div>
        </>
      )}
    </div>
  );
};

export default PostureStatusCard; 