import { render, screen } from '@testing-library/react';
import PostureAvatar from '../../../components/visualization/PostureAvatar';

// HTMLCanvasElement.prototype.getContext 모킹
// getContext가 호출되었는지, 그리고 반환된 컨텍스트의 메서드들이 호출되었는지 스파이하기 위함입니다.
let mockGetContext: jest.Mock;
let mockBeginPath: jest.Mock;
let mockMoveTo: jest.Mock;
let mockLineTo: jest.Mock;
let mockArc: jest.Mock;
let mockStroke: jest.Mock;
let mockClearRect: jest.Mock;
let mockSave: jest.Mock;
let mockRestore: jest.Mock;
let mockTranslate: jest.Mock;
let mockRotate: jest.Mock;
let mockFillText: jest.Mock;

beforeEach(() => {
  mockBeginPath = jest.fn();
  mockMoveTo = jest.fn();
  mockLineTo = jest.fn();
  mockArc = jest.fn();
  mockStroke = jest.fn();
  mockClearRect = jest.fn();
  mockSave = jest.fn();
  mockRestore = jest.fn();
  mockTranslate = jest.fn();
  mockRotate = jest.fn();
  mockFillText = jest.fn();

  mockGetContext = jest.fn().mockReturnValue({
    beginPath: mockBeginPath,
    moveTo: mockMoveTo,
    lineTo: mockLineTo,
    arc: mockArc,
    stroke: mockStroke,
    clearRect: mockClearRect,
    save: mockSave,
    restore: mockRestore,
    translate: mockTranslate,
    rotate: mockRotate,
    fillText: mockFillText,
    lineWidth: 0, // 기본값 설정
    lineCap: '',   // 기본값 설정
    lineJoin: '',  // 기본값 설정
    fillStyle: '', // 기본값 설정
    font: '',      // 기본값 설정
    textAlign: '', // 기본값 설정
  });

  HTMLCanvasElement.prototype.getContext = mockGetContext;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const defaultFeedback = {
  x: { angle: 0, risk: 'safe' as const, deviation: 0, normalRange: { min: -5, max: 5 }, message: '정상' },
  y: { angle: 0, risk: 'safe' as const, deviation: 0, normalRange: { min: -5, max: 5 }, message: '정상' },
  z: { angle: 0, risk: 'safe' as const, deviation: 0, normalRange: { min: -5, max: 5 }, message: '정상' }
};

describe('PostureAvatar', () => {
  it('renders a canvas element and gets context', () => {
    render(<PostureAvatar feedback={defaultFeedback} />);
    const canvasElement = screen.getByTestId('posture-avatar-canvas');
    expect(canvasElement).toBeInTheDocument();
    expect(mockGetContext).toHaveBeenCalledWith('2d');
  });

  it('calls canvas drawing methods when feedback changes', () => {
    mockClearRect.mockClear();
    mockBeginPath.mockClear();
    mockArc.mockClear();
    mockStroke.mockClear();
    mockMoveTo.mockClear();
    mockLineTo.mockClear();
    mockFillText.mockClear();
    mockSave.mockClear();
    mockRestore.mockClear();
    mockTranslate.mockClear();
    mockRotate.mockClear();

    const { rerender } = render(<PostureAvatar feedback={defaultFeedback} />);
    
    expect(mockClearRect).toHaveBeenCalled();
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockArc).toHaveBeenCalled();
    expect(mockStroke).toHaveBeenCalled();
    expect(mockMoveTo).toHaveBeenCalled();
    expect(mockLineTo).toHaveBeenCalled();
    expect(mockFillText).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
    expect(mockRestore).toHaveBeenCalled();
    expect(mockTranslate).toHaveBeenCalled();
    expect(mockRotate).toHaveBeenCalled();

    mockClearRect.mockClear();
    mockBeginPath.mockClear();
    mockArc.mockClear();
    mockStroke.mockClear();
    mockMoveTo.mockClear();
    mockLineTo.mockClear();
    mockFillText.mockClear();
    mockSave.mockClear();
    mockRestore.mockClear();
    mockTranslate.mockClear();
    mockRotate.mockClear();

    const newFeedback = {
      x: { angle: 10, risk: 'warning' as const, deviation: 5, normalRange: { min: -5, max: 5 }, message: '주의' },
      y: { angle: 5, risk: 'safe' as const, deviation: 0, normalRange: { min: -5, max: 5 }, message: '정상' },
      z: { angle: 2, risk: 'safe' as const, deviation: 0, normalRange: { min: -5, max: 5 }, message: '정상' }
    };
    rerender(<PostureAvatar feedback={newFeedback} />);

    expect(mockClearRect).toHaveBeenCalled();
    expect(mockBeginPath).toHaveBeenCalled();
  });

  it('uses provided width and height for the canvas', () => {
    render(<PostureAvatar feedback={defaultFeedback} width={200} height={250} />);
    const canvasElement = screen.getByTestId('posture-avatar-canvas');
    expect(canvasElement).toHaveAttribute('width', '200');
    expect(canvasElement).toHaveAttribute('height', '250');
  });

  it('sets default width and height if not provided', () => {
    render(<PostureAvatar feedback={defaultFeedback} />);
    const canvasElement = screen.getByTestId('posture-avatar-canvas');
    expect(canvasElement).toHaveAttribute('width', '200');
    expect(canvasElement).toHaveAttribute('height', '300');
  });

  // 각도에 따른 구체적인 드로잉 변화를 테스트하려면 스냅샷 테스팅이나
  // 픽셀 검증, 또는 mock된 드로잉 함수의 호출 인자들을 더 상세히 검증해야 합니다.
  // 여기서는 주요 함수들의 호출 여부만 확인합니다.
});

// Canvas에 접근 가능한 role을 추가하기 위한 헬퍼 (선택 사항)
// describe에만 적용하거나, jest.setup.js에 전역으로 설정할 수 있습니다.
// import {configure} from '@testing-library/dom'
// configure({
//   computedStyleSupportsPseudoElements: true,
//   getElementError: (message, container) => {
//     const error = new Error(message!)
//     error.name = 'TestingLibraryElementError'
//     error.stack = null
//     return error
//   },
//   asyncWrapper: async (cb) => cb(),
//   eventWrapper: (cb) => cb(),
//   // ... other default config
//    भूमिकाओं을 얻으십시오: {
//     ...require('@testing-library/dom/lib/role-helpers').getDefaultRoleAssigments(),
//     canvas: 'graphics-canvas', 
//   },
// }) 