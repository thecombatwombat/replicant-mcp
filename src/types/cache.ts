export interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
  metadata: {
    createdAt: number;
    type: string;
    sizeBytes?: number;
  };
}

export interface CacheConfig {
  maxEntries: number;
  maxEntrySizeBytes: number;
  defaultTtlMs: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 100,
  maxEntrySizeBytes: 1024 * 1024, // 1MB
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
};

export const CACHE_TTLS = {
  BUILD_OUTPUT: 30 * 60 * 1000, // 30 min
  TEST_RESULTS: 30 * 60 * 1000, // 30 min
  EMULATOR_LIST: 5 * 60 * 1000, // 5 min
  APP_LIST: 2 * 60 * 1000, // 2 min
  UI_TREE: 30 * 1000, // 30 sec
  GRADLE_VARIANTS: 60 * 60 * 1000, // 1 hour
} as const;
