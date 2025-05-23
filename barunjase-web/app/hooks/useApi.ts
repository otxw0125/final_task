import useSWR from 'swr';

/**
 * API 응답 인터페이스
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * API 응답 페이지네이션 정보 인터페이스
 */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

/**
 * API 응답 (페이지네이션 포함) 인터페이스
 */
export interface ApiResponseWithPagination<T> extends ApiResponse<T[]> {
  pagination?: PaginationInfo;
}

/**
 * JSON 데이터를 가져오는 fetcher 함수
 * 
 * @param url - 요청할 API URL
 * @returns Promise<any> - 요청 결과 데이터
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error = new Error('API 요청에 실패했습니다');
    throw error;
  }
  
  return res.json();
};

/**
 * API 데이터를 가져오는 커스텀 훅
 * 
 * SWR을 사용하여 데이터 캐싱, 자동 재검증, 포커스 시 재검증 등의 기능을 제공합니다.
 * 
 * @param url - 요청할 API URL
 * @param options - SWR 옵션
 * @returns SWR 응답 (data, error, isLoading, mutate)
 */
export function useApi<T>(url: string, options = {}) {
  return useSWR<ApiResponse<T> | ApiResponseWithPagination<T>>(url, fetcher, {
    refreshInterval: 0, // 자동 재검증 간격 (0은 자동 재검증 없음)
    revalidateOnFocus: true, // 포커스 시 재검증
    revalidateOnReconnect: true, // 재연결 시 재검증
    ...options
  });
}

/**
 * 실시간 센서 데이터를 가져오는 커스텀 훅
 * 
 * 일정 간격으로 자동 갱신되는 실시간 데이터에 적합합니다.
 * 
 * @param url - 요청할 API URL
 * @param interval - 갱신 간격 (밀리초)
 * @param options - SWR 옵션
 * @returns SWR 응답 (data, error, isLoading, mutate)
 */
export function useLiveApi<T>(url: string, interval = 3000, options = {}) {
  return useSWR<ApiResponse<T>>(url, fetcher, {
    refreshInterval: interval,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    ...options
  });
} 