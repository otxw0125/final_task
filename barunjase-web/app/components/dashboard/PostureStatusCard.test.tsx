import { render, screen } from '@testing-library/react';
import PostureStatusCard from './PostureStatusCard';
import ScoreGauge from '../charts/ScoreGauge'; // 모킹 대상
import PostureAvatar from '../posture/PostureAvatar'; // 모킹 대상

// ScoreGauge 컴포넌트 모킹
jest.mock('../charts/ScoreGauge', () => ({
  __esModule: true,
  default: jest.fn(({ score, size, thickness, label }) => (
    <div data-testid="score-gauge-mock">
      ScoreGauge Mock (Score: {score}, Size: {size}, Thickness: {thickness}, Label: {label})
    </div>
  )),
}));

// PostureAvatar 컴포넌트 모킹
jest.mock('../posture/PostureAvatar', () => ({
  __esModule: true,
  default: jest.fn(({ angles, width, height }) => (
    <div data-testid="posture-avatar-mock">
      PostureAvatar Mock (X: {angles.X}, Y: {angles.Y}, Z: {angles.Z}, Width: {width}, Height: {height})
    </div>
  )),
}));

const mockGoodPostureData = {
  score: 85,
  angles: { X: 5, Y: 2, Z: 1 },
  lastUpdated: '2023-01-01T12:00:00Z',
};

const mockOkayPostureData = {
  score: 65,
  angles: { X: 15, Y: 10, Z: 5 },
  lastUpdated: '2023-01-01T12:05:00Z',
};

const mockBadPostureData = {
  score: 40,
  angles: { X: -25, Y: -15, Z: -10 },
  lastUpdated: '2023-01-01T12:10:00Z',
};

describe('PostureStatusCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading message when isLoading is true', () => {
    render(<PostureStatusCard data={mockGoodPostureData} isLoading={true} />); // 데이터는 중요하지 않음
    expect(screen.getByText('데이터 로딩 중...')).toBeInTheDocument();
    expect(screen.queryByText('현재 자세 상태')).not.toBeInTheDocument();
  });

  describe('when data is loaded', () => {
    it('renders card title and last updated time', () => {
      render(<PostureStatusCard data={mockGoodPostureData} isLoading={false} />);
      expect(screen.getByText('현재 자세 상태')).toBeInTheDocument();
      expect(screen.getByText(`마지막 업데이트: ${new Date(mockGoodPostureData.lastUpdated).toLocaleString()}`)).toBeInTheDocument();
    });

    it('renders ScoreGauge with correct props', () => {
      render(<PostureStatusCard data={mockGoodPostureData} isLoading={false} />);
      const gaugeMock = screen.getByTestId('score-gauge-mock');
      expect(gaugeMock).toBeInTheDocument();
      expect(gaugeMock.textContent).toContain(`Score: ${mockGoodPostureData.score}`);
      expect(gaugeMock.textContent).toContain('Size: 160');
      expect(gaugeMock.textContent).toContain('Thickness: 10');
      expect(gaugeMock.textContent).toContain('Label: 자세 점수');
    });

    it('renders PostureAvatar with correct props', () => {
      render(<PostureStatusCard data={mockGoodPostureData} isLoading={false} />);
      const avatarMock = screen.getByTestId('posture-avatar-mock');
      expect(avatarMock).toBeInTheDocument();
      expect(avatarMock.textContent).toContain(`X: ${mockGoodPostureData.angles.X}`);
      expect(avatarMock.textContent).toContain(`Y: ${mockGoodPostureData.angles.Y}`);
      expect(avatarMock.textContent).toContain(`Z: ${mockGoodPostureData.angles.Z}`);
      expect(avatarMock.textContent).toContain('Width: 220');
      expect(avatarMock.textContent).toContain('Height: 300');
    });

    it('displays correct message and style for good posture (score >= 80)', () => {
      render(<PostureStatusCard data={mockGoodPostureData} isLoading={false} />);
      expect(screen.getByText('바른 자세입니다')).toHaveClass('text-green-500');
      expect(screen.getByText('현재 자세를 유지하세요.')).toBeInTheDocument();
    });

    it('displays correct message and style for okay posture (score >= 60 and < 80)', () => {
      render(<PostureStatusCard data={mockOkayPostureData} isLoading={false} />);
      expect(screen.getByText('적절한 자세입니다')).toHaveClass('text-yellow-500');
      expect(screen.getByText('목과 허리의 각도를 조금 더 바르게 유지하세요.')).toBeInTheDocument();
    });

    it('displays correct message and style for bad posture (score < 60)', () => {
      render(<PostureStatusCard data={mockBadPostureData} isLoading={false} />);
      expect(screen.getByText('자세가 올바르지 않습니다')).toHaveClass('text-red-500');
      expect(screen.getByText('허리를 펴고 모니터 높이를 조정해 보세요.')).toBeInTheDocument();
    });

    it('formats lastUpdated time correctly, or shows "업데이트 중..." if not provided', () => {
      const { rerender } = render(<PostureStatusCard data={{ ...mockGoodPostureData, lastUpdated: undefined }} isLoading={false} />);
      expect(screen.getByText('마지막 업데이트: 업데이트 중...')).toBeInTheDocument();
      
      const specificTime = '2024-07-26T10:30:00Z';
      rerender(<PostureStatusCard data={{ ...mockGoodPostureData, lastUpdated: specificTime }} isLoading={false} />);
      expect(screen.getByText(`마지막 업데이트: ${new Date(specificTime).toLocaleString()}`)).toBeInTheDocument();
    });
  });
}); 