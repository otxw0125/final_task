import { FC } from 'react';
import AngleChart from '../charts/AngleChart';

/**
 * 각도 데이터 인터페이스
 */
interface AngleData {
  timestamp: string;
  X: number;
  Y: number;
  Z: number;
}

/**
 * 각도 차트 카드 컴포넌트 속성
 */
interface AngleChartCardProps {
  data: AngleData[];
  title?: string;
  isLoading?: boolean;
  period?: string;
}

/**
 * 각도 변화 차트를 표시하는 카드 컴포넌트
 */
const AngleChartCard: FC<AngleChartCardProps> = ({
  data,
  title = '자세 각도 변화',
  isLoading = false,
  period = '최근 30분'
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6" data-testid="angle-chart-card-e2e">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-sm text-gray-500">{period}</div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-60" data-testid="angle-chart-loading">
          <div className="animate-pulse text-gray-400">데이터 로딩 중...</div>
        </div>
      ) : data.length > 0 ? (
        <AngleChart data={data} height={350} showLegend />
      ) : (
        <div className="flex items-center justify-center bg-gray-50 h-60 rounded-lg" data-testid="angle-chart-no-data">
          <p className="text-gray-500">데이터가 없습니다</p>
        </div>
      )}
      
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-md p-3">
          <p className="text-xs text-gray-500">X축 (목 기울기)</p>
          <p className="text-lg font-semibold text-blue-600" data-testid="angle-chart-x-value">
            {data.length > 0 ? `${Math.round(data[data.length - 1]?.X || 0)}°` : '-'}
          </p>
        </div>
        
        <div className="bg-indigo-50 rounded-md p-3">
          <p className="text-xs text-gray-500">Y축 (허리 기울기)</p>
          <p className="text-lg font-semibold text-indigo-600" data-testid="angle-chart-y-value">
            {data.length > 0 ? `${Math.round(data[data.length - 1]?.Y || 0)}°` : '-'}
          </p>
        </div>
        
        <div className="bg-purple-50 rounded-md p-3">
          <p className="text-xs text-gray-500">Z축 (몸 회전)</p>
          <p className="text-lg font-semibold text-purple-600" data-testid="angle-chart-z-value">
            {data.length > 0 ? `${Math.round(data[data.length - 1]?.Z || 0)}°` : '-'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AngleChartCard; 