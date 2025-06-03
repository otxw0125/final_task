'use client';

import { useState } from 'react';

interface ApiResponse {
  success: boolean;
  message: string;
  [key: string]: any;
}

const DataManagementButtons = () => {
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [messages, setMessages] = useState<{ [key: string]: { text: string; type: 'success' | 'error' } }>({});

  const showMessage = (key: string, text: string, type: 'success' | 'error') => {
    setMessages(prev => ({ ...prev, [key]: { text, type } }));
    setTimeout(() => {
      setMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[key];
        return newMessages;
      });
    }, 5000);
  };

  const handleApiCall = async (endpoint: string, buttonKey: string, body?: any) => {
    setIsLoading(prev => ({ ...prev, [buttonKey]: true }));
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const result: ApiResponse = await response.json();
      
      if (result.success) {
        showMessage(buttonKey, result.message, 'success');
      } else {
        showMessage(buttonKey, result.message || '작업 실행 중 오류가 발생했습니다.', 'error');
      }
    } catch (error) {
      console.error(`Error calling ${endpoint}:`, error);
      showMessage(buttonKey, '네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(prev => ({ ...prev, [buttonKey]: false }));
    }
  };

  const handleCleanupAndReset = async () => {
    const buttonKey = 'cleanup';
    setIsLoading(prev => ({ ...prev, [buttonKey]: true }));

    try {
      // 1. 데이터 삭제
      const deleteResponse = await fetch('/api/data-management/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!deleteResponse.ok) {
        throw new Error('데이터 삭제 실패');
      }

      // 2. 플래그 리셋
      const resetResponse = await fetch('/api/data-management/reset-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!resetResponse.ok) {
        throw new Error('플래그 리셋 실패');
      }

      const resetResult: ApiResponse = await resetResponse.json();
      showMessage(buttonKey, '데이터 정리 및 플래그 리셋이 완료되었습니다.', 'success');
      
    } catch (error) {
      console.error('Error in cleanup and reset:', error);
      showMessage(buttonKey, '데이터 정리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(prev => ({ ...prev, [buttonKey]: false }));
    }
  };

  const buttonClass = `
    px-4 py-2 rounded-lg font-medium transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    hover:shadow-lg active:scale-95
  `;

  const primaryButtonClass = `${buttonClass} bg-blue-600 hover:bg-blue-700 text-white`;
  const secondaryButtonClass = `${buttonClass} bg-green-600 hover:bg-green-700 text-white`;
  const dangerButtonClass = `${buttonClass} bg-red-600 hover:bg-red-700 text-white`;
  const warningButtonClass = `${buttonClass} bg-yellow-600 hover:bg-yellow-700 text-white`;

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">데이터 관리</h2>
      
      {/* 버튼 그룹 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* 데이터 정리 및 플래그 리셋 버튼 */}
        <button
          onClick={handleCleanupAndReset}
          disabled={isLoading.cleanup}
          className={dangerButtonClass}
        >
          {isLoading.cleanup ? '처리중...' : '데이터 정리 & 리셋'}
        </button>

        {/* rawsensordata를 angledata로 변환 버튼 */}
        <button
          onClick={() => handleApiCall('/api/data-management/convert-to-angle', 'convert')}
          disabled={isLoading.convert}
          className={secondaryButtonClass}
        >
          {isLoading.convert ? '변환중...' : 'Raw → Angle 변환'}
        </button>

        {/* 초기값 AngleData 제외 버튼 */}
        <button
          onClick={() => handleApiCall('/api/data-management/reset-filter-initial', 'excludeInitial', { excludeCount: 5, useTimeRange: false })}
          disabled={isLoading.excludeInitial}
          className={warningButtonClass}
        >
          {isLoading.excludeInitial ? '제외중...' : '초기값 데이터 제외'}
        </button>

        {/* 시간 기반 초기값 제외 버튼 */}
        <button
          onClick={() => handleApiCall('/api/data-management/reset-filter-initial', 'excludeTimeRange', { excludeTimeSeconds: 30, useTimeRange: true })}
          disabled={isLoading.excludeTimeRange}
          className={warningButtonClass}
        >
          {isLoading.excludeTimeRange ? '제외중...' : '초기 30초 데이터 제외'}
        </button>
      </div>

      {/* 상태 메시지 표시 */}
      <div className="space-y-2">
        {Object.entries(messages).map(([key, message]) => (
          <div
            key={key}
            className={`p-3 rounded-md text-sm ${
              message.type === 'success' 
                ? 'bg-green-900 text-green-200 border border-green-700' 
                : 'bg-red-900 text-red-200 border border-red-700'
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

      {/* 기능 설명 */}
      <div className="mt-4 p-4 bg-gray-700 rounded-md">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">기능 설명:</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• <strong>데이터 정리 & 리셋:</strong> ID가 7자리 미만인 rawsensordata와 모든 angledata를 삭제한 후, 남은 rawsensordata의 processedToAngle 플래그를 false로 초기화</li>
          <li>• <strong>Raw → Angle 변환:</strong> 처리되지 않은 rawsensordata를 angledata로 변환</li>
          <li>• <strong>초기값 데이터 제외:</strong> 칼만 필터 안정화를 위한 초기 5개 데이터를 제외</li>
          <li>• <strong>초기 30초 데이터 제외:</strong> 센서 안정화를 위한 처음 30초 데이터를 제외</li>
        </ul>
      </div>
    </div>
  );
};

export default DataManagementButtons; 