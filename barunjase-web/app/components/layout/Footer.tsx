/**
 * 웹 애플리케이션의 하단 푸터 컴포넌트
 * 
 * 저작권 정보와 기타 링크를 표시합니다.
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-100 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-600">
              &copy; {currentYear} 바른자세 - 더 건강한 자세를 위한 모니터링 솔루션
            </p>
          </div>
          
          <div className="flex space-x-4">
            <a href="#" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              이용약관
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              개인정보처리방침
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              고객지원
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 