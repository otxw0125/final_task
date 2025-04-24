// frontend/vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // '/api'로 시작하는 요청을 백엔드 서버(예: http://localhost:3000)로 전달
      '/api': {
        target: 'http://localhost:3000', // Express 백엔드 서버 주소
        changeOrigin: true, // 대상 서버의 origin으로 호스트 헤더 변경
        // rewrite: (path) => path.replace(/^\/api/, '') // 필요시 경로 재작성
      },
      // Socket.IO 연결을 위한 프록시 설정
      '/socket.io': {
          target: 'ws://localhost:3000', // 웹소켓 프로토콜 사용
          ws: true // 웹소켓 프록시 활성화
      }
    }
  }
})
