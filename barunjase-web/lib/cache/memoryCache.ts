interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL_SECONDS = 60; // 기본 TTL 1분

/**
 * 간단한 인메모리 캐시 유틸리티
 */
export const memoryCache = {
  /**
   * 캐시에서 데이터를 가져옵니다.
   * 키가 존재하지 않거나 데이터가 만료된 경우 undefined를 반환합니다.
   * @param key 캐시 키
   */
  get: <T>(key: string): T | undefined => {
    const entry = cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      cache.delete(key); // 만료된 데이터 삭제
      return undefined;
    }
    return entry.value as T;
  },

  /**
   * 캐시에 데이터를 저장합니다.
   * @param key 캐시 키
   * @param value 저장할 값
   * @param ttlInSeconds TTL (초 단위), 기본값은 DEFAULT_TTL_SECONDS
   */
  set: <T>(key: string, value: T, ttlInSeconds: number = DEFAULT_TTL_SECONDS): void => {
    const expiresAt = Date.now() + ttlInSeconds * 1000;
    cache.set(key, { value, expiresAt });
  },

  /**
   * 캐시에서 특정 키의 데이터를 삭제합니다.
   * @param key 삭제할 캐시 키
   */
  delete: (key: string): void => {
    cache.delete(key);
  },

  /**
   * 모든 캐시를 비웁니다.
   */
  clear: (): void => {
    cache.clear();
  },

  /**
   * (선택적) 주기적으로 만료된 캐시 정리 (예: 서버 시작 시 또는 특정 간격으로 실행)
   * 실제 프로덕션 환경에서는 더 정교한 TTL 관리나 LRU 정책이 필요할 수 있습니다.
   */
  cleanupExpired: (): void => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key);
      }
    }
    // console.log('Expired cache entries cleaned up.'); // 필요시 로깅
  },
};

// 주기적 정리 예시 (애플리케이션 시작 시 또는 필요에 따라 호출)
// setInterval(() => {
//   memoryCache.cleanupExpired();
// }, 5 * 60 * 1000); // 예: 5분마다 만료된 캐시 정리 