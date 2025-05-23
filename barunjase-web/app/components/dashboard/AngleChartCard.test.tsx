import { render, screen } from '@testing-library/react';
import AngleChartCard from './AngleChartCard';
import AngleChart from '../charts/AngleChart'; // 모킹 대상

// AngleChart 컴포넌트 모킹
// 실제 차트 렌더링 대신 간단한 플레이스홀더를 반환합니다.
jest.mock('../charts/AngleChart', () => ({
  __esModule: true,
  default: jest.fn(({ data, height, showLegend }) => (
    <div data-testid="angle-chart-mock">
      AngleChart Mock (Data points: {data.length}, Height: {height}, Legend: {showLegend ? 'true' : 'false'})
    </div>
  )),
}));

const mockAngleData = [
  { timestamp: '2023-01-01T10:00:00Z', X: 10, Y: 5, Z: 2 },
  { timestamp: '2023-01-01T10:01:00Z', X: 12, Y: 6, Z: 1 },
  { timestamp: '2023-01-01T10:02:00Z', X: 9, Y: 4, Z: 3 },
];

describe('AngleChartCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and period correctly', () => {
    render(<AngleChartCard data={[]} title="커스텀 타이틀" period="최근 1시간" />);
    expect(screen.getByText('커스텀 타이틀')).toBeInTheDocument();
    expect(screen.getByText('최근 1시간')).toBeInTheDocument();
  });

  it('renders default title and period if not provided', () => {
    render(<AngleChartCard data={[]} />);
    expect(screen.getByText('자세 각도 변화')).toBeInTheDocument(); // 기본값
    expect(screen.getByText('최근 30분')).toBeInTheDocument(); // 기본값
  });

  it('shows loading message when isLoading is true', () => {
    render(<AngleChartCard data={[]} isLoading={true} />);
    expect(screen.getByText('데이터 로딩 중...')).toBeInTheDocument();
    expect(screen.queryByTestId('angle-chart-mock')).not.toBeInTheDocument();
    expect(screen.queryByText('데이터가 없습니다')).not.toBeInTheDocument();
  });

  it('shows "no data" message when data is empty and not loading', () => {
    render(<AngleChartCard data={[]} isLoading={false} />);
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument();
    expect(screen.queryByTestId('angle-chart-mock')).not.toBeInTheDocument();
    expect(screen.queryByText('데이터 로딩 중...')).not.toBeInTheDocument();
  });

  it('renders AngleChart and latest angles when data is provided and not loading', () => {
    render(<AngleChartCard data={mockAngleData} isLoading={false} />);
    
    const mockAngleChart = screen.getByTestId('angle-chart-mock');
    expect(mockAngleChart).toBeInTheDocument();
    expect(mockAngleChart.textContent).toContain('Data points: 3');
    expect(mockAngleChart.textContent).toContain('Height: 350');
    expect(mockAngleChart.textContent).toContain('Legend: true');

    // 최신 각도 값 확인 (mockAngleData의 마지막 데이터)
    expect(screen.getByText('X축 (목 기울기)').nextSibling?.textContent?.trim()).toBe('9°');
    expect(screen.getByText('Y축 (허리 기울기)').nextSibling?.textContent?.trim()).toBe('4°');
    expect(screen.getByText('Z축 (몸 회전)').nextSibling?.textContent?.trim()).toBe('3°');

    expect(screen.queryByText('데이터 로딩 중...')).not.toBeInTheDocument();
    expect(screen.queryByText('데이터가 없습니다')).not.toBeInTheDocument();
  });

  it('renders latest angles as "-" when data is empty', () => {
    render(<AngleChartCard data={[]} isLoading={false} />);
    expect(screen.getByText('X축 (목 기울기)').nextSibling?.textContent?.trim()).toBe('-');
    expect(screen.getByText('Y축 (허리 기울기)').nextSibling?.textContent?.trim()).toBe('-');
    expect(screen.getByText('Z축 (몸 회전)').nextSibling?.textContent?.trim()).toBe('-');
  });
}); 