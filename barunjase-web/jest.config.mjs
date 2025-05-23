import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // if you have a setup file
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    // Handle module aliases
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    // '\\.(css|less|scss|sass)$': 'identity-obj-proxy', // CSS Modules 모킹 (필요한 경우)
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  // ESM 관련 설정 추가
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // node_modules 내의 특정 ESM 패키지 변환 (필요시)
  // transformIgnorePatterns: [
  //   '/node_modules/(?!swiper|ssr-window|dom7).+\.js$'
  // ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'], // e2e 디렉토리 제외
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig); 