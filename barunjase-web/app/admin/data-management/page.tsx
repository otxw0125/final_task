'use client';

import { useState } from 'react';

export default function DataManagementPage() {
  const [resetLoading, setResetLoading] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [processMessage, setProcessMessage] = useState('');
  const [processStage, setProcessStage] = useState<'idle' | 'waiting' | 'processing' | 'completed'>('idle');

  const handleResetData = async () => {
    if (!confirm('정말로 모든 angledata를 삭제하고 rawsensordata의 processedToAngle을 false로 변경하시겠습니까?')) {
      return;
    }

    setResetLoading(true);
    setResetMessage('');

    try {
      const response = await fetch('/api/admin/reset-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setResetMessage(`✅ ${data.message} (angledata: ${data.deletedAngleCount}개 삭제, rawsensordata: ${data.updatedRawDataCount}개 업데이트)`);
      } else {
        setResetMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Reset error:', error);
      setResetMessage('❌ 요청 중 오류가 발생했습니다.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleProcessData = async () => {
    if (!confirm('데이터 처리를 시작하시겠습니까? 15초 간격으로 절반씩 처리됩니다.')) {
      return;
    }

    setProcessLoading(true);
    setProcessMessage('');
    setProcessStage('waiting');

    try {
      const response = await fetch('/api/admin/process-data-staged', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage: 'start' }),
      });

      const data = await response.json();
      
      if (data.success) {
        setProcessMessage(`✅ ${data.message}`);
        setProcessStage('processing');
        
        // 30초 후에 완료 상태로 변경 (15초 + 15초)
        setTimeout(() => {
          setProcessStage('completed');
          setProcessMessage(prev => prev + '\n🎉 모든 데이터 처리가 완료되었습니다.');
        }, 35000); // 여유있게 35초로 설정
      } else {
        setProcessMessage(`❌ ${data.message}`);
        setProcessStage('idle');
      }
    } catch (error) {
      console.error('Process error:', error);
      setProcessMessage('❌ 요청 중 오류가 발생했습니다.');
      setProcessStage('idle');
    } finally {
      setProcessLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">데이터 관리</h1>
            <p className="mt-1 text-sm text-gray-600">
              센서 데이터와 각도 데이터를 관리하는 관리자 페이지입니다.
            </p>
          </div>

          <div className="p-6 space-y-8">
            {/* 데이터 리셋 섹션 */}
            <div className="border border-red-200 rounded-lg p-6 bg-red-50">
              <h2 className="text-xl font-semibold text-red-800 mb-4">
                ⚠️ 데이터 리셋
              </h2>
              <p className="text-red-700 mb-4">
                이 작업은 다음을 수행합니다:
              </p>
              <ul className="list-disc list-inside text-red-700 mb-6 space-y-1">
                <li>angledata 컬렉션의 모든 데이터 삭제</li>
                <li>rawsensordata의 모든 processedToAngle 플래그를 false로 변경</li>
              </ul>
              
              <button
                onClick={handleResetData}
                disabled={resetLoading}
                className={`px-6 py-3 rounded-md font-medium transition-colors ${
                  resetLoading
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {resetLoading ? '처리 중...' : '데이터 리셋 실행'}
              </button>

              {resetMessage && (
                <div className="mt-4 p-4 rounded-md bg-white border">
                  <p className="text-sm whitespace-pre-line">{resetMessage}</p>
                </div>
              )}
            </div>

            {/* 단계적 데이터 처리 섹션 */}
            <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
              <h2 className="text-xl font-semibold text-blue-800 mb-4">
                🔄 단계적 데이터 처리
              </h2>
              <p className="text-blue-700 mb-4">
                이 작업은 다음을 수행합니다:
              </p>
              <ul className="list-disc list-inside text-blue-700 mb-6 space-y-1">
                <li>processedToAngle이 false인 rawsensordata를 찾습니다</li>
                <li>15초 후에 첫 번째 절반을 각도 데이터로 변환합니다</li>
                <li>다시 15초 후에 나머지 절반을 각도 데이터로 변환합니다</li>
                <li>각 데이터에 대해 자세 점수도 함께 생성합니다</li>
              </ul>

              {processStage !== 'idle' && (
                <div className="mb-4 p-4 rounded-md bg-white border">
                  <div className="flex items-center space-x-2">
                    {processStage === 'waiting' && (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-blue-700">15초 대기 중...</span>
                      </>
                    )}
                    {processStage === 'processing' && (
                      <>
                        <div className="animate-pulse rounded-full h-4 w-4 bg-blue-600"></div>
                        <span className="text-sm text-blue-700">데이터 처리 중...</span>
                      </>
                    )}
                    {processStage === 'completed' && (
                      <>
                        <div className="rounded-full h-4 w-4 bg-green-600"></div>
                        <span className="text-sm text-green-700">처리 완료</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <button
                onClick={handleProcessData}
                disabled={processLoading || processStage !== 'idle'}
                className={`px-6 py-3 rounded-md font-medium transition-colors ${
                  processLoading || processStage !== 'idle'
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {processLoading ? '시작 중...' : processStage !== 'idle' ? '처리 중...' : '단계적 처리 시작'}
              </button>

              {processMessage && (
                <div className="mt-4 p-4 rounded-md bg-white border">
                  <p className="text-sm whitespace-pre-line">{processMessage}</p>
                </div>
              )}
            </div>

            {/* 안내 정보 */}
            <div className="bg-gray-100 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">💡 사용 안내</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• <strong>데이터 리셋</strong>: 모든 각도 데이터를 삭제하고 원본 센서 데이터를 미처리 상태로 되돌립니다.</p>
                <p>• <strong>단계적 처리</strong>: 원본 센서 데이터를 15초 간격으로 절반씩 나누어 각도 데이터로 변환합니다.</p>
                <p>• 처리 중에는 다른 작업을 시작할 수 없습니다.</p>
                <p>• 모든 작업은 되돌릴 수 없으니 신중하게 진행하세요.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 