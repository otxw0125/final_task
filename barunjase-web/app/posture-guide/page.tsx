import type { Metadata } from 'next';

export const revalidate = 3600; // 1시간마다 페이지 재생성 (ISR)

export const metadata: Metadata = {
  title: '바른자세 가이드 | 바른자세',
  description: '올바른 자세를 유지하기 위한 기본 가이드입니다.',
};

interface GuideSection {
  id: string;
  title: string;
  content: string[];
  imageUrl?: string;
}

// 가이드 내용은 실제로는 CMS나 마크다운 파일에서 가져올 수 있습니다.
const postureGuides: GuideSection[] = [
  {
    id: 'sitting',
    title: '올바른 앉은 자세',
    content: [
      '의자에 깊숙이 앉아 허리를 등받이에 지지합니다.',
      '무릎은 90도 각도를 유지하고 발바닥 전체가 바닥에 닿도록 합니다.',
      '어깨는 편안하게 내리고 팔꿈치는 책상 높이와 비슷하게 유지합니다.',
      '컴퓨터 화면 상단이 눈높이보다 약간 아래에 오도록 조절합니다.',
      '정기적으로 일어나 스트레칭을 해줍니다.',
    ],
    imageUrl: '/images/sitting-posture.png', // 예시 이미지 경로
  },
  {
    id: 'standing',
    title: '올바른 서 있는 자세',
    content: [
      '양발에 체중을 고르게 분산시킵니다.',
      '어깨는 뒤로 젖히고 가슴을 폅니다.',
      '머리는 몸의 중심선 위에 오도록 하고, 턱은 살짝 당깁니다.',
      '복부에 가볍게 힘을 주어 허리를 보호합니다.',
    ],
    imageUrl: '/images/standing-posture.png', // 예시 이미지 경로
  },
  {
    id: 'monitor',
    title: '모니터 및 작업 환경 설정',
    content: [
      '모니터 상단은 눈높이 또는 약간 아래에 위치해야 합니다.',
      '키보드와 마우스는 몸 가까이 두어 팔을 멀리 뻗지 않도록 합니다.',
      '자주 사용하는 물건은 손이 쉽게 닿는 곳에 둡니다.',
      '조명은 적절하게 유지하여 눈의 피로를 줄입니다.',
    ],
  },
];

export default function PostureGuidePage() {
  return (
    <div className="container mx-auto px-4 py-12 bg-gray-800 text-white">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-blue-400">바른자세 가이드</h1>
        <p className="mt-2 text-lg text-gray-300">건강한 자세를 위한 핵심 팁을 알아보세요.</p>
      </header>

      <div className="space-y-12">
        {postureGuides.map((guide) => (
          <section key={guide.id} className="p-8 bg-gray-700 rounded-xl shadow-lg">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">{guide.title}</h2>
            <div className={`grid gap-6 ${guide.imageUrl ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              <div>
                <ul className="list-disc list-inside space-y-2 text-gray-200">
                  {guide.content.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              {guide.imageUrl && (
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={guide.imageUrl} 
                    alt={guide.title} 
                    className="rounded-lg shadow-md max-h-64 object-contain"
                  />
                  {/* Next.js Image 컴포넌트를 사용하려면 public 폴더에 이미지 필요 및 width/height 지정 */}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-16 text-center text-gray-400">
        <p>본 가이드는 일반적인 조언이며, 개인의 상태에 따라 전문가와 상담하세요.</p>
        <p>&copy; {new Date().getFullYear()} 바른자세 프로젝트. All rights reserved.</p>
      </footer>
    </div>
  );
} 