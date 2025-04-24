<template>
  <div>
    <h2>실시간 센서 데이터</h2>
    <p v-if="latestRecord">
      사용자: {{ latestRecord.userId }} <br>
      값 (X): {{ latestRecord.tilt?.x }} <br>
      시간: {{ new Date(latestRecord.timestamp).toLocaleString() }}
    </p>
    <p v-else>데이터 수신 대기 중...</p>

    <h3>최근 100개 데이터</h3>
    <ul>
      <li v-for="record in recentData" :key="record._id">
        {{ new Date(record.timestamp).toLocaleTimeString() }}: {{ record.tilt?.x }} (User: {{ record.userId }})
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { io } from 'socket.io-client'; // socket.io 클라이언트 import

const recentData = ref([]);
const latestRecord = ref(null);
let socket = null;

// 백엔드 API 주소 (개발 시 Vite 프록시 설정 필요, 아래 설명 참조)
const API_BASE_URL = '/api'; // 또는 http://localhost:3000/api (백엔드 서버 주소)

// 최근 데이터 불러오기 함수
const fetchRecentData = async () => {
  try {
    // Express 백엔드의 /api/sensor-data 엔드포인트 호출
    const response = await axios.get(`${API_BASE_URL}/sensor-data`);
    recentData.value = response.data;
    if (response.data.length > 0) {
      latestRecord.value = response.data[0]; // 가장 최신 데이터를 초기값으로 설정
    }
  } catch (error) {
    console.error('센서 데이터 로딩 실패:', error);
  }
};

onMounted(() => {
  // 컴포넌트 마운트 시 초기 데이터 로드
  fetchRecentData();

  // Socket.IO 연결 설정 (백엔드 서버 주소로 연결)
  // 개발 시에는 Vite 프록시를 통하거나 백엔드 주소를 직접 명시
  socket = io(); // 현재 도메인으로 연결 시도 (Vite 프록시 사용 시)
  // 또는 socket = io('http://localhost:3000'); // 백엔드 주소 명시

  // 'newData' 이벤트 수신 리스너
  socket.on('newData', (newRecord) => {
    console.log('새 데이터 수신 (Socket.IO):', newRecord);
    latestRecord.value = newRecord;
    // 최근 데이터 목록 앞쪽에 새 데이터 추가 (옵션)
    recentData.value.unshift(newRecord);
    if (recentData.value.length > 100) {
      recentData.value.pop(); // 100개 초과 시 가장 오래된 데이터 제거
    }
  });

  // 연결 확인 (디버깅용)
  socket.on('connect', () => {
    console.log('Socket.IO 서버에 연결되었습니다. ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket.IO 연결 오류:', err);
  });
});

onUnmounted(() => {
  // 컴포넌트 언마운트 시 Socket.IO 연결 해제
  if (socket) {
    socket.disconnect();
  }
});
</script>

<style scoped>
/* 필요한 스타일 추가 */
ul {
  list-style: none;
  padding: 0;
}
li {
  margin-bottom: 5px;
  font-size: 0.9em;
}
</style>
