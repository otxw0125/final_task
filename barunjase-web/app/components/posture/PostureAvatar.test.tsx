import { render, screen } from '@testing-library/react';
import PostureAvatar from './PostureAvatar';

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

const defaultAngles = { X: 0, Y: 0, Z: 0 };

describe('PostureAvatar', () => {
  it('renders a canvas element and gets context', () => {
    render(<PostureAvatar angles={defaultAngles} />);
    const canvasElement = screen.getByTestId('posture-avatar-canvas');
    expect(canvasElement).toBeInTheDocument();
    expect(mockGetContext).toHaveBeenCalledWith('2d');
  });

  it('calls canvas drawing methods when angles change', () => {
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

    const { rerender } = render(<PostureAvatar angles={defaultAngles} />);
    
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

    const newAngles = { X: 10, Y: 5, Z: 2 };
    rerender(<PostureAvatar angles={newAngles} />);

    expect(mockClearRect).toHaveBeenCalled();
    expect(mockBeginPath).toHaveBeenCalled();
  });

  it('uses provided width and height for the canvas', () => {
    render(<PostureAvatar angles={defaultAngles} width={200} height={250} />);
    const canvasElement = screen.getByTestId('posture-avatar-canvas');
    expect(canvasElement).toHaveAttribute('width', '200');
    expect(canvasElement).toHaveAttribute('height', '250');
  });

  it('sets default width and height if not provided', () => {
    render(<PostureAvatar angles={defaultAngles} />);
    const canvasElement = screen.getByTestId('posture-avatar-canvas');
    expect(canvasElement).toHaveAttribute('width', '300');
    expect(canvasElement).toHaveAttribute('height', '400');
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