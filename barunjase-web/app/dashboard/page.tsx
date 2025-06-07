'use client';
import { useState, useEffect } from 'react';
import PostureAvatar from '../../components/visualization/PostureAvatar';
import PostureStatsChart from '../../components/visualization/PostureStatsChart';
import type { CurrentPostureFeedback } from '../api/feedback/current/route';

interface DashboardData {
  feedback?: CurrentPostureFeedback;
  loading: boolean;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({ loading: true });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setData(prev => ({ ...prev, loading: true }));
        
        const feedbackResponse = await fetch('/api/feedback/current');
        const feedbackData = await feedbackResponse.json() as CurrentPostureFeedback;
        
        setData({
          feedback: feedbackData,
          loading: false
        });
        
      } catch (error) {
        console.error('데이터 가져오기 실패:', error);
        setData({ loading: false });
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // 5초마다 갱신

    return () => clearInterval(interval);
  }, []);

  if (data.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const feedback = data.feedback;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">바른자세 모니터링</h1>
          <p className="mt-2 text-gray-600">실시간 앉은 자세 분석 및 피드백</p>
          
          {/* 데이터 통계 정보 */}
          {feedback?.dataStats && (
            <div className="mt-4 inline-flex items-center space-x-4 bg-blue-50 px-4 py-2 rounded-lg">
              <span className="text-sm text-blue-800">
                📊 총 변환 데이터: <strong>{feedback.dataStats.totalAngleData.toLocaleString()}개</strong>
              </span>
            </div>
          )}
        </div>

        {/* 메인 컨텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 왼쪽: 아바타 및 전체 점수 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-center">현재 자세</h2>
            
            {feedback?.success ? (
              <div className="text-center">
                <PostureAvatar 
                  feedback={feedback.feedbackPerAxis} 
                  width={300} 
                  height={400} 
                />
                
                {/* 전체 점수 */}
                <div className="mt-6">
                  <div className="text-3xl font-bold text-gray-800">
                    {feedback.overallScore || 0}점
                  </div>
                  <div className="text-gray-600">자세 점수</div>
                  
                  {/* 전체 피드백 메시지 */}
                  <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                    <p className="text-gray-800">{feedback.message}</p>
                  </div>
                </div>
                
                {/* 자세 통계 차트 */}
                <PostureStatsChart dataStats={feedback.dataStats} />
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-600">{feedback?.message || '데이터를 불러올 수 없습니다.'}</p>
              </div>
            )}
          </div>

          {/* 오른쪽: 축별 상세 정보 */}
          <div className="space-y-6">
            {/* X축 (좌우 기울기) */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">좌우 기울기 (X축)</h3>
              {feedback?.feedbackPerAxis.x ? (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-2xl font-bold">
                      {feedback.feedbackPerAxis.x.angle.toFixed(1)}°
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      feedback.feedbackPerAxis.x.risk === 'safe' ? 'bg-green-100 text-green-800' :
                      feedback.feedbackPerAxis.x.risk === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {feedback.feedbackPerAxis.x.risk === 'safe' ? '정상' :
                       feedback.feedbackPerAxis.x.risk === 'warning' ? '주의' : '위험'}
                    </span>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>정상 범위</span>
                      <span>{feedback.feedbackPerAxis.x.normalRange.min}° ~ {feedback.feedbackPerAxis.x.normalRange.max}°</span>
                    </div>
                    {/* 범위 바 */}
                    <div className="relative h-2 bg-gray-200 rounded">
                      <div 
                        className="absolute h-full bg-green-400 rounded"
                        style={{
                          left: `${((feedback.feedbackPerAxis.x.normalRange.min + 30) / 60) * 100}%`,
                          width: `${((feedback.feedbackPerAxis.x.normalRange.max - feedback.feedbackPerAxis.x.normalRange.min) / 60) * 100}%`
                        }}
                      ></div>
                      <div 
                        className={`absolute w-1 h-4 -mt-1 rounded ${
                          feedback.feedbackPerAxis.x.risk === 'safe' ? 'bg-green-600' :
                          feedback.feedbackPerAxis.x.risk === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{
                          left: `${Math.max(0, Math.min(100, ((feedback.feedbackPerAxis.x.angle + 30) / 60) * 100))}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-gray-700">{feedback.feedbackPerAxis.x.message}</p>
                </div>
              ) : (
                <p className="text-gray-500">데이터 없음</p>
              )}
            </div>

            {/* Y축 (상하 기울기) */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">상하 기울기 (Y축)</h3>
              {feedback?.feedbackPerAxis.y ? (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-2xl font-bold">
                      {feedback.feedbackPerAxis.y.angle.toFixed(1)}°
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      feedback.feedbackPerAxis.y.risk === 'safe' ? 'bg-green-100 text-green-800' :
                      feedback.feedbackPerAxis.y.risk === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {feedback.feedbackPerAxis.y.risk === 'safe' ? '정상' :
                       feedback.feedbackPerAxis.y.risk === 'warning' ? '주의' : '위험'}
                    </span>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>정상 범위</span>
                      <span>{feedback.feedbackPerAxis.y.normalRange.min}° ~ {feedback.feedbackPerAxis.y.normalRange.max}°</span>
                    </div>
                    {/* 범위 바 */}
                    <div className="relative h-2 bg-gray-200 rounded">
                      <div 
                        className="absolute h-full bg-green-400 rounded"
                        style={{
                          left: `${((feedback.feedbackPerAxis.y.normalRange.min + 30) / 60) * 100}%`,
                          width: `${((feedback.feedbackPerAxis.y.normalRange.max - feedback.feedbackPerAxis.y.normalRange.min) / 60) * 100}%`
                        }}
                      ></div>
                      <div 
                        className={`absolute w-1 h-4 -mt-1 rounded ${
                          feedback.feedbackPerAxis.y.risk === 'safe' ? 'bg-green-600' :
                          feedback.feedbackPerAxis.y.risk === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{
                          left: `${Math.max(0, Math.min(100, ((feedback.feedbackPerAxis.y.angle + 30) / 60) * 100))}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-gray-700">{feedback.feedbackPerAxis.y.message}</p>
                </div>
              ) : (
                <p className="text-gray-500">데이터 없음</p>
              )}
            </div>

            {/* 연결 상태 및 정보 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">시스템 정보</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">데이터 상태:</span>
                  <span className={`font-medium ${feedback?.success ? 'text-green-600' : 'text-red-600'}`}>
                    {feedback?.success ? '정상' : '오류'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">모니터링 축:</span>
                  <span className="text-gray-800">X (좌우), Y (상하)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}