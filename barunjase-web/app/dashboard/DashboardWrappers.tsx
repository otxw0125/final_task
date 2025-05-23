'use client';

import AngleChartCard from '../../components/dashboard/AngleChartCard';
import PostureStatusCard from '../../components/dashboard/PostureStatusCard';

// AngleChartCard는 이미 SWR을 내부적으로 사용하므로, 추가 props 없이 래핑합니다.
export function AngleChartCardWrapper() {
  return <AngleChartCard />;
}

// PostureStatusCard도 이미 SWR을 내부적으로 사용하므로, 추가 props 없이 래핑합니다.
export function PostureStatusCardWrapper() {
  return <PostureStatusCard />;
} 