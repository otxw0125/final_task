//file next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // 클라이언트에 노출해도 되는 환경 변수만 포함
    // NODE_ENV는 Next.js가 자동으로 관리하므로 제외
    ML_SERVICE_BASE_URL: process.env.ML_SERVICE_BASE_URL,
  },
  
  // 서버 컴포넌트에서만 사용할 환경 변수는 여기에 포함하지 않음
  // (MONGODB_URI, SECRET 등은 자동으로 서버에서만 접근 가능)
  
  // ESM 지원 및 최적화 설정
  experimental: {
    // ESM을 사용하는 외부 패키지들 허용
    esmExternals: true,
  },
  
  // TypeScript 설정
  typescript: {
    // 빌드 시 타입 검사 수행 (개발 중에는 IDE에서도 확인)
    ignoreBuildErrors: false,
  },
  
  // 웹팩 설정 (필요한 경우)
  webpack: (config, { isServer }) => {
    // 서버 사이드에서만 적용되는 설정
    if (isServer) {
      // MongoDB 관련 패키지들이 클라이언트 번들에 포함되지 않도록 설정
      config.externals.push({
        'mongodb': 'commonjs mongodb',
      });
    }
    
    return config;
  },
  
  // 환경별 설정
  async headers() {
    return [
      {
        // API 라우트에 대한 CORS 헤더 설정 (개발용)
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' ? '*' : 'same-origin',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, x-api-key',
          },
        ],
      },
    ];
  },
  
  // 개발 서버 설정
  async rewrites() {
    return [
      // API 라우트 리라이팅이 필요한 경우 여기에 추가
    ];
  },
};

export default nextConfig;