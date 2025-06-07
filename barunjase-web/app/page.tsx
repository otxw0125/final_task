import Link from 'next/link';
import MainLayout from './components/layout/MainLayout';

export default function Home() {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-4xl font-bold mb-6 text-blue-600">바른자세</h1>
        <p className="text-xl mb-12 max-w-2xl">
          당신의 자세를 실시간으로 모니터링하고 분석하여 바른 자세를 유지할 수 있도록 도와주는 솔루션입니다.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
        <Link
          href="/dashboard"
          className="bg-blue-600 text-white px-6 py-3 rounded-md text-lg hover:bg-blue-700 transition duration-200"
        >
          대시보드 바로가기
        </Link>
        
          <Link
            href="/admin/data-management"
            className="bg-gray-600 text-white px-6 py-3 rounded-md text-lg hover:bg-gray-700 transition duration-200"
          >
            데이터 관리 (관리자)
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8 w-full max-w-5xl">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="text-blue-600 text-2xl mb-4">실시간 모니터링</div>
            <p className="text-gray-600">
              센서 데이터를 기반으로 자세를 실시간으로 분석하고 피드백을 제공합니다.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="text-blue-600 text-2xl mb-4">자세 시각화</div>
            <p className="text-gray-600">
              직관적인 아바타와 차트를 통해 자세의 변화를 쉽게 확인할 수 있습니다.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="text-blue-600 text-2xl mb-4">맞춤형 피드백</div>
            <p className="text-gray-600">
              개인의 자세 습관을 분석하여 개선을 위한 맞춤형 조언을 제공합니다.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
