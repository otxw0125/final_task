import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getCurrentPostureFeedbackForServer, getPostureHistoryForServer } from '../../lib/data/feedback';
import CurrentPostureFeedbackCard from '../../components/dashboard/CurrentPostureFeedbackCard';
import PostureHistoryVisualization from '../../components/dashboard/PostureHistoryVisualization';
// import { AngleChartCardWrapper, PostureStatusCardWrapper } from './DashboardWrappers'; // 주석 처리

// 동적 메타데이터 생성
export async function generateMetadata(): Promise<Metadata> {
  const currentFeedback = await getCurrentPostureFeedbackForServer();
  let title = "자세 대시보드";
  let description = "실시간 자세 피드백과 히스토리를 확인하세요.";

  if (currentFeedback) {
    title = `현재 자세 점수: ${currentFeedback.overallScore}점 | 바른자세`;
    description = `현재 자세는 ${currentFeedback.overallScore}점 입니다. ${currentFeedback.summaryMessage}`;
}

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      // images: ['/some-image.png'], // 필요시 대표 이미지 추가
    },
  };
}

// 로딩 UI 컴포넌트
function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="h-64 bg-gray-700 rounded-lg animate-pulse"></div>
      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> */}
      {/*   <div className="h-96 bg-gray-700 rounded-lg animate-pulse"></div> */}
      {/*   <div className="h-96 bg-gray-700 rounded-lg animate-pulse"></div> */}
      {/* </div> */}
      <div className="h-80 bg-gray-700 rounded-lg animate-pulse"></div>
    </div>
  );
}

// 데이터 로딩 및 UI를 위한 비동기 서버 컴포넌트
async function DashboardData() {
  const initialCurrentFeedback = await getCurrentPostureFeedbackForServer();
  
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const initialHistoryParams = {
    startDate: sevenDaysAgo.toISOString().split('T')[0],
    endDate: today,
    timeUnit: 'day' as const,
  };
  const initialPostureHistory = await getPostureHistoryForServer(initialHistoryParams);

  return (
    <>
      {/* 현재 자세 피드백 (초기 데이터는 서버에서, 이후 업데이트는 클라이언트에서 SWR로) */} 
      <CurrentPostureFeedbackCard initialData={initialCurrentFeedback} />

      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6"> */}
      {/*   <AngleChartCardWrapper /> */}
      {/*   <PostureStatusCardWrapper /> */}
      {/* </div> */}

      {/* 자세 히스토리 시각화 (초기 데이터는 서버에서, 이후 필터 변경 등은 클라이언트에서 SWR로) */} 
      <PostureHistoryVisualization 
        initialData={initialPostureHistory} 
        initialParams={initialHistoryParams}
      />
    </>
  );
}

export default async function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-6">자세 대시보드</h1>
      <Suspense fallback={<DashboardLoadingSkeleton />}>
        <DashboardData />
      </Suspense>
      </div>
  );
} 

// 클라이언트 컴포넌트들을 위한 래퍼 (기존 page.tsx에서 분리 또는 단순화)
// app/dashboard/DashboardWrappers.tsx 파일 생성 필요 