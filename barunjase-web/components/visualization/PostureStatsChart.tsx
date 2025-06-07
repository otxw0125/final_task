'use client';

import React from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { CurrentPostureFeedback } from '../../app/api/feedback/current/route';

interface PostureStatsChartProps {
  dataStats?: CurrentPostureFeedback['dataStats'];
}

const COLORS = {
  safe: '#4ade80',    // green-400
  warning: '#facc15', // yellow-400  
  danger: '#f87171'   // red-400
};

const PostureStatsChart: React.FC<PostureStatsChartProps> = ({ dataStats }) => {
  if (!dataStats) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">자세 통계</h3>
        <div className="text-center py-8 text-gray-500">
          통계 데이터를 불러오는 중...
        </div>
      </div>
    );
  }

  // 위험도 분포 데이터 준비
  const riskData = [
    { name: '정상', value: dataStats.riskDistribution.safe, color: COLORS.safe },
    { name: '주의', value: dataStats.riskDistribution.warning, color: COLORS.warning },
    { name: '위험', value: dataStats.riskDistribution.danger, color: COLORS.danger }
  ].filter(item => item.value > 0);

  // 시간별 트렌드 데이터 준비
  const trendData = dataStats.recentDataTrend.map(item => ({
    time: new Date(item.timestamp).getHours() + ':00',
    count: item.count
  }));

  const totalRecentData = dataStats.riskDistribution.safe + 
                         dataStats.riskDistribution.warning + 
                         dataStats.riskDistribution.danger;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <h3 className="text-lg font-semibold mb-6">자세 통계 분석</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 위험도 분포 파이 차트 */}
        <div>
          <h4 className="text-md font-medium mb-3 text-center">위험도 분포 (최근 100개 데이터)</h4>
          {riskData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, value, percent}) => `${name}: ${value}개 (${(percent * 100).toFixed(1)}%)`}
                  labelLine={false}
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}개`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500">
              분석할 데이터가 없습니다
            </div>
          )}
          
          {/* 범례 */}
          <div className="flex justify-center mt-2 space-x-4">
            {riskData.map((item, index) => (
              <div key={index} className="flex items-center space-x-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 시간별 데이터 수집 트렌드 */}
        <div>
          <h4 className="text-md font-medium mb-3 text-center">24시간 데이터 수집 트렌드</h4>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value}개`, '데이터 수']}
                  labelFormatter={(label) => `시간: ${label}`}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500">
              24시간 내 데이터가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">
              {dataStats.totalAngleData.toLocaleString()}
            </div>
            <div className="text-sm text-blue-800">총 데이터</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">
              {totalRecentData > 0 ? ((dataStats.riskDistribution.safe / totalRecentData) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-green-800">정상 비율</div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-yellow-600">
              {totalRecentData > 0 ? ((dataStats.riskDistribution.warning / totalRecentData) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-yellow-800">주의 비율</div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-600">
              {totalRecentData > 0 ? ((dataStats.riskDistribution.danger / totalRecentData) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-red-800">위험 비율</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostureStatsChart; 