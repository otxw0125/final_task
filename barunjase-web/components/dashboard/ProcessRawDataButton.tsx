'use client';

import { useState } from 'react';

interface ProcessResult {
  success: boolean;
  message: string;
  data?: {
    rawSensorDataId: string;
    rawSensorDataNumber: number;
    createdAngleDataId: string;
    calculatedAngles: {
      x: number;
      y: number;
      z: number;
    };
  };
  error?: string;
}

export default function ProcessRawDataButton() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const processOldestData = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch('/api/raw-to-angle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          processOldestUnprocessed: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          data: {
            rawSensorDataId: data.rawSensorDataId,
            rawSensorDataNumber: data.rawSensorDataNumber,
            createdAngleDataId: data.createdAngleDataId,
            calculatedAngles: data.calculatedAngles,
          },
        });
      } else {
        setResult({
          success: false,
          message: data.message || '처리 중 오류가 발생했습니다.',
          error: data.error,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: '네트워크 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processMultipleData = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // 최대 5개의 미처리 데이터를 순차적으로 처리
      for (let i = 0; i < 5; i++) {
        try {
          const response = await fetch('/api/raw-to-angle', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              processOldestUnprocessed: true,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            results.push(data);
            successCount++;
          } else {
            errorCount++;
            errors.push(`오류: ${data.message}`);
            if (data.message.includes('no unprocessed data available') || 
                data.message.includes('Raw sensor data not found')) {
              // 더 이상 처리할 데이터가 없으면 루프 종료
              break;
            }
          }
        } catch (error) {
          errorCount++;
          errors.push(`네트워크 오류: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (successCount > 0) {
        setResult({
          success: true,
          message: `처리 완료: 성공 ${successCount}건, 실패 ${errorCount}건`,
          data: results.length > 0 ? results[results.length - 1] : undefined,
        });
      } else {
        setResult({
          success: false,
          message: `모든 처리가 실패했습니다. 실패 ${errorCount}건`,
          error: errors.join(' | '),
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: '일괄 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">센서 데이터 처리</h3>
      <p className="text-sm text-gray-600 mb-4">
        원시 센서 데이터를 각도 데이터로 변환하고 자세를 분석합니다.
      </p>

      <div className="flex gap-3 mb-4">
        <button
          onClick={processOldestData}
          disabled={isProcessing}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? '처리 중...' : '1개 데이터 처리'}
        </button>

        <button
          onClick={processMultipleData}
          disabled={isProcessing}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? '처리 중...' : '일괄 처리 (최대 5개)'}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
            {result.success ? '✅ 처리 성공' : '❌ 처리 실패'}
          </div>
          <div className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
            {result.message}
          </div>
          
          {result.success && result.data && (
            <div className="mt-3 text-sm text-gray-700">
              <div><strong>데이터 번호:</strong> {result.data.rawSensorDataNumber}</div>
              <div><strong>계산된 각도:</strong></div>
              <div className="ml-4">
                <div>• Pitch 변화량: {result.data.calculatedAngles.x.toFixed(2)}°</div>
                <div>• Roll 변화량: {result.data.calculatedAngles.y.toFixed(2)}°</div>
                <div>• Z축 (미사용): {result.data.calculatedAngles.z.toFixed(2)}°</div>
              </div>
            </div>
          )}
          
          {!result.success && result.error && (
            <div className="mt-2 text-sm text-red-600">
              <strong>오류 상세:</strong> {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 