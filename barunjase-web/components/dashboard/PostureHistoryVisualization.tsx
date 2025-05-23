'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { PostureHistoryResponse, TimeSegmentSummary, PostureHistoryRequestParams } from '../../app/api/feedback/history/route';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const getScoreColor = (score: number | undefined | null): string => {
  if (score === undefined || score === null) return '#6b7280'; // gray-500
  if (score < 50) return '#ef4444'; // red-500
  if (score < 70) return '#f59e0b'; // yellow-500
  return '#22c55e'; // green-500
};

interface PostureHistoryVisualizationProps {
  initialData?: PostureHistoryResponse | null;
  initialParams?: PostureHistoryRequestParams;
}

const PostureHistoryVisualization: React.FC<PostureHistoryVisualizationProps> = ({ initialData, initialParams }) => {
  const defaultStartDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - (initialParams?.timeUnit === 'hour' ? 1 : 7));
    return date.toISOString().split('T')[0];
  }, [initialParams?.timeUnit]);
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [apiParams, setApiParams] = useState<PostureHistoryRequestParams>(initialParams || {
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    timeUnit: 'day',
  });

  const { data: historyData, error, isLoading } = useSWR<PostureHistoryResponse>(
    `/api/feedback/history?startDate=${apiParams.startDate}&endDate=${apiParams.endDate}&timeUnit=${apiParams.timeUnit}`,
    fetcher,
    {
      refreshInterval: 60000 * 5,
      revalidateOnFocus: false,
      revalidateOnMount: !initialData,
      fallbackData: initialData && 
                    initialParams && 
                    initialParams.startDate === apiParams.startDate && 
                    initialParams.endDate === apiParams.endDate && 
                    initialParams.timeUnit === apiParams.timeUnit 
                    ? initialData 
                    : undefined,
    }
  );
  
  const currentDataToRender = historyData || initialData;

  const renderContent = () => {
    if (isLoading && !currentDataToRender) {
      return <div className="p-4 text-center text-gray-400">히스토리 데이터 로딩 중...</div>;
    }
    if (error && !currentDataToRender) {
      console.error('SWR error in PostureHistoryVisualization:', error);
      return <div className="p-4 text-center text-red-400">히스토리 데이터를 불러오는데 실패했습니다. (에러: {error.message})</div>;
    }
    if (!currentDataToRender || !currentDataToRender.timeSeriesSummary || currentDataToRender.timeSeriesSummary.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500">
          {/* <h4 className="text-lg font-semibold mb-3">시간대별 자세 상태 (평균 점수)</h4> */}
          <p className="mt-3">표시할 시간대별 자세 히스토리 데이터가 없습니다.</p>
          
          {/* <h4 className="text-lg font-semibold mb-3 mt-4">자세 점수 변화 추이</h4> */}
          <p className="mt-4">표시할 자세 점수 변화 추이 데이터가 없습니다.</p>
        </div>
      );
    }

    const { timeSeriesSummary, overallAverageScore, scoreTrend, mostFrequentProblems } = currentDataToRender;

    const chartData = timeSeriesSummary.map((segment: TimeSegmentSummary) => ({
      name: segment.period.split('T')[0] + (apiParams.timeUnit === 'hour' ? ' ' + segment.period.split('T')[1].substring(0,2) + '시' : ''),
      score: segment.avgScore,
    }));

    return (
      <>
        <div>
          <h4 className="text-lg font-semibold mb-3">시간대별 자세 상태 (평균 점수)</h4>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '0.375rem'}} 
                  itemStyle={{ color: '#e5e7eb'}}
                  formatter={(value: number, name: string) => {
                    if (name === '평균 점수' && value !== null && value !== undefined) return [`${value.toFixed(1)}점`, name];
                    return [value, name];
                  }}
                />
                <Bar dataKey="score" name="평균 점수">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500">표시할 시간대별 데이터가 없습니다.</p>
          )}
        </div>

        <div>
          <h4 className="text-lg font-semibold mb-3">자세 점수 변화 추이</h4>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }}/>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '0.375rem'}} 
                  itemStyle={{ color: '#e5e7eb'}}
                  formatter={(value: number) => value !== null && value !== undefined ? [`${value.toFixed(1)}점`, '점수'] : ['N/A', '점수']}
                />
                <Legend wrapperStyle={{ fontSize: '12px'}}/>
                <Line type="monotone" dataKey="score" name="자세 점수" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} dot={{r: 3}} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500">점수 추이를 표시하기에 데이터가 부족합니다 (최소 2개 필요).</p>
          )}
        </div>

        <div className="p-4 bg-gray-700 rounded-lg">
          <h4 className="text-md font-semibold mb-2">종합 분석 (최근 {apiParams.timeUnit === 'day' ? '7일' : apiParams.timeUnit === 'hour' ? '24시간' : '기간'} 기준)</h4>
          <p className="text-sm">전체 평균 점수: <span className={`font-bold ${getScoreColor(overallAverageScore)}`}>{overallAverageScore?.toFixed(1) ?? 'N/A'}점</span></p>
          <p className="text-sm">점수 추세: <span className={scoreTrend === 'improving' ? 'text-green-400' : scoreTrend === 'worsening' ? 'text-red-400' : 'text-gray-400'}>{scoreTrend ?? 'N/A'}</span></p>
          {mostFrequentProblems && mostFrequentProblems.length > 0 && (
            <div className="mt-2">
              <h5 className="text-sm font-semibold">자주 발생한 문제 Top {mostFrequentProblems.length}:</h5>
              <ul className="list-disc list-inside text-xs text-gray-300">
                {mostFrequentProblems.map((problem, index) => (
                  <li key={index}>{problem.description} ({problem.axis}, {problem.problemType}) - 발생: {problem.count}회</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-gray-700 rounded-lg mt-4">
          <h4 className="text-md font-semibold mb-2">주간/월간 리포트 (개발 예정)</h4>
          <p className="text-xs text-gray-400">상세한 주간 및 월간 자세 분석 리포트가 여기에 표시됩니다.</p>
        </div>
      </>
    );
  };

  return (
    <div data-testid="posture-history-viz" className="space-y-8 mt-6">
      {renderContent()}
    </div>
  );
};

export default PostureHistoryVisualization; 