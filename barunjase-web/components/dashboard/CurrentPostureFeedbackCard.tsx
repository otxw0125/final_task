'use client';

import React, { useEffect, useState, useCallback } from 'react';
import useSWR from 'swr';
import { CurrentPostureFeedback } from '../../app/api/feedback/current/route'; // API 타입 임포트
import PostureAvatar from '../visualization/PostureAvatar'; // 아바타 컴포넌트 임포트
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'; // 아이콘 임포트
import PostureHistoryVisualization from './PostureHistoryVisualization'; // 새로 임포트

const fetcher = (url: string) => fetch(url).then(res => res.json());

const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000; // 5분 쿨다운
const HIGH_SCORE_THRESHOLD = 90; // 긍정적 피드백 점수 기준
const DANGER_SCORE_THRESHOLD = 50; // 위험 알림 점수 기준
const WARNING_SCORE_THRESHOLD = 70; // 주의 알림 점수 기준

// 알림 상태 관리를 위한 타입
type NotificationPermission = 'default' | 'granted' | 'denied';

interface CurrentPostureFeedbackCardProps {
  initialData?: CurrentPostureFeedback | null; // 초기 데이터 prop 추가
}

const CurrentPostureFeedbackCard: React.FC<CurrentPostureFeedbackCardProps> = ({ initialData }) => {
  const { data: feedback, error, isLoading } = useSWR<CurrentPostureFeedback>(
    '/api/feedback/current', 
    fetcher, 
    {
      refreshInterval: 5000,
      fallbackData: initialData || undefined, // SWR에 fallbackData로 초기 데이터 제공
    }
  );

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options);
      setLastNotificationTime(Date.now());
    } 
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission as NotificationPermission);
    }
  }, []);

  useEffect(() => {
    if (!feedback || !feedback.overallScore) return;
    if (initialData && feedback.timestamp === initialData.timestamp && feedback.overallScore === initialData.overallScore) {
        // 초기 데이터와 현재 SWR 데이터가 동일하면 (첫 로드 직후) 알림 스킵 가능 (선택적)
        return;
    }

    const now = Date.now();
    const score = feedback.overallScore;

    if (now - lastNotificationTime < NOTIFICATION_COOLDOWN_MS) return;

    let notificationTitle = '';
    let notificationBody = '';
    let shouldNotify = false;

    if (score < DANGER_SCORE_THRESHOLD) {
      notificationTitle = '🚨 심각한 자세 경고!';
      notificationBody = `현재 자세 점수가 ${score}점입니다. 즉시 자세를 교정해주세요! ${feedback.summaryMessage}`;
      shouldNotify = true;
    } else if (score < WARNING_SCORE_THRESHOLD) {
      notificationTitle = '⚠️ 자세 주의';
      notificationBody = `현재 자세 점수가 ${score}점입니다. 자세에 신경 써주세요. ${feedback.summaryMessage}`;
      // 주의 알림은 더 긴 쿨다운을 적용하거나, 다른 조건과 결합할 수 있음 (여기서는 동일 쿨다운)
      shouldNotify = true;
    }

    if (shouldNotify) {
      showNotification(notificationTitle, { body: notificationBody, tag: 'posture-feedback' });
    }
  }, [feedback, lastNotificationTime, showNotification, initialData]);

  const requestNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission as NotificationPermission);
        if (permission === 'granted') {
          showNotification('알림이 활성화되었습니다.', { body: '자세 변동 시 알림을 보내드립니다.' });
        } else {
           alert('알림 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.');
        }
      });
    }
  };

  if (isLoading && !initialData) return <div className="p-4 bg-gray-800 rounded-lg shadow text-white animate-pulse">로딩 중...</div>;
  if (error && !feedback) return <div className="p-4 bg-red-800 rounded-lg shadow text-white">데이터를 불러오는데 실패했습니다. (오류: {error?.message || '알 수 없음'})</div>;
  if (!feedback || !feedback.feedbackPerAxis) return <div className="p-4 bg-yellow-800 rounded-lg shadow text-white">피드백 데이터가 올바르지 않거나 없습니다.</div>;

  const getRiskColor = (risk: 'safe' | 'warning' | 'danger' | 'unknown'): string => {
    switch (risk) {
      case 'safe': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'danger': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };
  
  const getRiskBorderColor = (score: number): string => {
    if (score < DANGER_SCORE_THRESHOLD) return 'border-red-500';
    if (score < WARNING_SCORE_THRESHOLD) return 'border-yellow-500';
    return 'border-green-500';
  };

  const getRiskPulseAnimation = (score: number): string => {
    if (score < DANGER_SCORE_THRESHOLD) return 'animate-pulse-border-red';
    if (score < WARNING_SCORE_THRESHOLD) return 'animate-pulse-border-yellow';
    return '';
  };

  return (
    <div className={`p-6 bg-gray-800 rounded-lg shadow-xl text-white border-4 ${getRiskBorderColor(feedback.overallScore)} ${getRiskPulseAnimation(feedback.overallScore)} transition-all duration-300`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">현재 자세 피드백</h2>
        {feedback.overallScore >= HIGH_SCORE_THRESHOLD && (
          <CheckCircleIcon className="h-8 w-8 text-green-400" title="매우 좋은 자세입니다!" />
        )}
        {feedback.overallScore < DANGER_SCORE_THRESHOLD && (
          <ExclamationTriangleIcon className="h-8 w-8 text-red-400 animate-ping" title="자세가 매우 위험합니다!" />
        )}
      </div>

      {notificationPermission === 'default' && (
        <button 
          onClick={requestNotificationPermission}
          className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
        >
          자세 알림 활성화
        </button>
      )}
      {notificationPermission === 'denied' && (
        <p className="mb-4 text-sm text-yellow-400">
          알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해주세요.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* 아바타 섹션 */}
        <div className="md:col-span-1 flex flex-col items-center justify-center">
          <PostureAvatar
            feedback={feedback.feedbackPerAxis} // 축별 피드백 전달
            width={180}
            height={280}
          />
          <p className="mt-2 text-sm text-gray-400">실시간 자세 아바타</p>
        </div>

        {/* 점수 및 요약 섹션 */}
        <div className="md:col-span-2">
          <div className="mb-4">
            <span className="text-lg font-medium">종합 자세 점수: </span>
            <span 
              data-testid="overall-score"
              className={`text-3xl font-bold ${getRiskColor(
              feedback.overallScore < DANGER_SCORE_THRESHOLD ? 'danger' : feedback.overallScore < WARNING_SCORE_THRESHOLD ? 'warning' : 'safe'
            )}`}>
              {feedback.overallScore}점
            </span>
            {feedback.cacheStatus && <span className="ml-2 text-xs text-gray-500">({feedback.cacheStatus})</span>}
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-1">요약:</h3>
            <p className="text-gray-300">{feedback.summaryMessage}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-1">상세 조언:</h3>
            {feedback.detailedAdvice && feedback.detailedAdvice.length > 0 ? (
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {feedback.detailedAdvice.map((advice, index) => (
                  <li key={index}>{advice}</li>
                ))}
              </ul>
            ) : (
              <p>특별한 조언이 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['x', 'y', 'z'] as const).map(axisKey => {
          const axisData = feedback.feedbackPerAxis[axisKey];
          const axisName = axisKey === 'x' ? '목(Pitch)' : axisKey === 'y' ? '허리(Roll)' : '몸통(Yaw)';
          if (!axisData) return null;
          return (
            <div key={axisKey} className={`p-3 rounded-md bg-gray-700 ${getRiskColor(axisData.risk)}`}>
              <h4 className="font-semibold">{axisName}</h4>
              <p>각도: {axisData.angle.toFixed(1)}°</p>
              <p>상태: <span className="font-medium">{axisData.risk.toUpperCase()}</span></p>
              <p className="text-xs">정상: {axisData.normalRange.min}° ~ {axisData.normalRange.max}°</p>
              {axisData.deviation !== undefined && axisData.deviation > 0 && (
                <p className="text-xs">편차: {axisData.deviation.toFixed(1)}°</p>
              )}
            </div>
          );
        })}
      </div>
      
      {/* 피드백 히스토리 시각화 컴포넌트로 교체 */}
      <PostureHistoryVisualization />
    </div>
  );
};

export default CurrentPostureFeedbackCard; 