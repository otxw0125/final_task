import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

/**
 * 차트 데이터 인터페이스
 */
interface AngleData {
  timestamp: string;
  X: number; // 피치 (목 기울기)
  Y: number; // 롤 (허리 기울기)
  Z: number; // 요 (몸 회전)
}

/**
 * 각도 차트 컴포넌트 속성
 */
interface AngleChartProps {
  data: AngleData[];
  title?: string;
  height?: number;
  showLegend?: boolean;
}

/**
 * 각도 데이터 시각화 차트 컴포넌트
 * 
 * X, Y, Z 축의 각도 변화를 선 그래프로 표시합니다.
 */
const AngleChart = ({
  data,
  title = '자세 각도 데이터',
  height = 300,
  showLegend = true
}: AngleChartProps) => {
  const [chartData, setChartData] = useState<ChartData<'line'>>({
    datasets: [],
  });
  
  // 데이터가 변경될 때마다 차트 데이터 업데이트
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    const labels = data.map(item => {
      const date = new Date(item.timestamp);
      return date.toLocaleTimeString();
    });
    
    setChartData({
      labels,
      datasets: [
        {
          label: '목 기울기 (X)',
          data: data.map(item => item.X),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          tension: 0.3,
        },
        {
          label: '허리 기울기 (Y)',
          data: data.map(item => item.Y),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          tension: 0.3,
        },
        {
          label: '몸 회전 (Z)',
          data: data.map(item => item.Z),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          tension: 0.3,
        }
      ]
    });
  }, [data]);
  
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
      },
      title: {
        display: !!title,
        text: title
      },
    },
    scales: {
      y: {
        min: -90,
        max: 90,
        title: {
          display: true,
          text: '각도 (°)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        }
      },
      x: {
        title: {
          display: true,
          text: '시간'
        },
        grid: {
          display: false
        }
      }
    }
  };
  
  return (
    <div style={{ height }}>
      {data && data.length > 0 ? (
        <Line data={chartData} options={chartOptions} />
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <p className="text-gray-500">데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
};

export default AngleChart; 