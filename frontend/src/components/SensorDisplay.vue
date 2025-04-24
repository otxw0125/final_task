<template>
  <div>
    <h2>센서 데이터 분포 (각도별 개수)</h2>
    <!-- 차트를 감싸는 div -->
    <div class="chart-container">
      <!-- Line 대신 Bar 컴포넌트 사용 -->
      <Bar v-if="chartData.labels.length > 0" :data="chartData" :options="chartOptions" />
      <p v-else>데이터 로딩 중 또는 표시할 데이터가 없습니다...</p>
    </div>

    <hr style="margin: 20px 0;">

    <h2>최신 데이터 값</h2>
    <p v-if="latestRecord">
      사용자: {{ latestRecord.userId }} <br>
      값 (X): {{ latestRecord.tilt?.x?.toFixed(2) }} <br>
      시간: {{ new Date(latestRecord.timestamp).toLocaleString() }}
    </p>
    <p v-else>데이터 수신 대기 중...</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { io } from 'socket.io-client';
// *** 1. Bar 컴포넌트 임포트 ***
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  // *** 1. LineElement 대신 BarElement 임포트 ***
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// *** 1. Chart.js 구성 요소 등록 (BarElement 추가) ***
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement, // BarElement 등록
  Title,
  Tooltip,
  Legend
);

const allSensorData = ref([]);
const latestRecord = ref(null);
let socket = null;
// 데이터 포인트 수는 이제 전체 데이터를 사용하거나 다른 기준으로 정할 수 있습니다.
// const MAX_DATA_POINTS = 1000; // 예시: 최근 1000개 데이터 사용

const API_BASE_URL = '/api';

// 초기 데이터 로드 함수 (필요시 limit 조정)
const fetchRecentData = async () => {
  try {
    // 초기 로드 시 가져올 데이터 개수 (예: 최근 200개)
    const response = await axios.get(`${API_BASE_URL}/sensor-data?limit=200`);
    // 여기서는 시간순 정렬이 필수는 아님
    allSensorData.value = response.data;
    if (response.data.length > 0) {
      // 최신 데이터는 여전히 필요할 수 있음 (시간 역순으로 첫번째)
      latestRecord.value = response.data[0];
    }
  } catch (error) {
    console.error('센서 데이터 로딩 실패:', error);
  }
};

// *** 2. chartData 계산 로직 변경 ***
const chartData = computed(() => {
  const angleCounts = {}; // { 각도: 개수 } 형태의 객체

  // allSensorData 순회하며 각도별 개수 집계 (정수로 반올림)
  allSensorData.value.forEach(record => {
    if (record.tilt && typeof record.tilt.x === 'number') {
      const roundedAngle = Math.round(record.tilt.x); // 각도를 정수로 반올림
      angleCounts[roundedAngle] = (angleCounts[roundedAngle] || 0) + 1;
    }
  });

  // 집계된 데이터를 각도 순으로 정렬
  const sortedAngles = Object.keys(angleCounts).map(Number).sort((a, b) => a - b);

  return {
    labels: sortedAngles.map(String), // X축 레이블 (각도 값, 문자열로 변환)
    datasets: [
      {
        label: 'Frequency', // 데이터셋 레이블
        backgroundColor: '#36A2EB', // 막대 색상
        borderColor: '#36A2EB', // 막대 테두리 색상
        data: sortedAngles.map(angle => angleCounts[angle]), // Y축 데이터 (개수)
      }
    ]
  };
});

// *** 3. chartOptions 수정 ***
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { // Y축 설정 (개수)
      beginAtZero: true, // 0부터 시작
      title: {
        display: true,
        text: 'Count' // Y축 제목
      }
    },
    x: { // X축 설정 (각도)
      title: {
        display: true,
        text: 'Angle (°)' // X축 제목
      }
      // 카테고리 스케일이 기본값이므로 type 지정 불필요
    }
  },
  plugins: {
    legend: {
      display: true // 범례 표시 (Frequency)
    },
    tooltip: {
      enabled: true // 툴팁 표시
    }
  }
}));

onMounted(() => {
  fetchRecentData();
  socket = io();

  socket.on('newData', (newRecord) => {
    console.log('새 데이터 수신 (Socket.IO):', newRecord);
    latestRecord.value = newRecord;

    // 새 데이터를 allSensorData 배열에 추가
    allSensorData.value.push(newRecord);

    // 데이터가 너무 많아지면 오래된 데이터 제거 (선택 사항)
    // 예: 최대 1000개 유지
    // while (allSensorData.value.length > MAX_DATA_POINTS) {
    //   allSensorData.value.shift();
    // }
  });

  socket.on('connect', () => {
    console.log('Socket.IO 서버에 연결되었습니다. ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket.IO 연결 오류:', err);
  });
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
  }
});
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 400px;
  width: 100%;
}

hr {
  margin: 20px 0;
}

p {
  margin-bottom: 10px;
}
</style>
