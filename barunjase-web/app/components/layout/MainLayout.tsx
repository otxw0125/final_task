import Header from './Header';
import Footer from './Footer';

/**
 * 메인 레이아웃 컴포넌트
 * 
 * 모든 페이지에 적용되는 공통 레이아웃으로, 헤더와 푸터를 포함합니다.
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {React.ReactNode} props.children - 레이아웃 내부에 렌더링할 컴포넌트
 */
interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      
      <Footer />
    </div>
  );
};

export default MainLayout; 