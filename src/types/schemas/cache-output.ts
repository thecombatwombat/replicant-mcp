import { z } from "zod";

/**
 * Cache config shape returned by getConfig()
 */
export const CacheConfigSchema = z.object({
  maxEntries: z.number(),
  maxEntrySizeBytes: z.number(),
  defaultTtlMs: z.number(),
});

/**
 * Cache stats shape returned by getStats()
 */
export const CacheStatsSchema = z.object({
  entryCount: z.number(),
  totalSizeBytes: z.number(),
  typeBreakdown: z.record(z.string(), z.number()),
  config: CacheConfigSchema,
});

/**
 * Output for cache get-stats operation
 */
export const CacheGetStatsOutput = z.object({
  stats: CacheStatsSchema,
});

/**
 * Output for cache clear operation (specific key)
 */
export const CacheClearKeyOutput = z.object({
  cleared: z.string(),
});

/**
 * Output for cache clear operation (all)
 */
export const CacheClearAllOutput = z.object({
  cleared: z.literal("all"),
});

/**
 * Output for cache get-config and set-config operations
 */
export const CacheGetConfigOutput = z.object({
  config: CacheConfigSchema,
});

/**
 * Union of all cache tool outputs
 */
export const CacheOutput = z.union([
  CacheGetStatsOutput,
  CacheClearKeyOutput,
  CacheClearAllOutput,
  CacheGetConfigOutput,
]);

export type CacheGetStatsOutputType = z.infer<typeof CacheGetStatsOutput>;
export type CacheClearKeyOutputType = z.infer<typeof CacheClearKeyOutput>;
export type CacheClearAllOutputType = z.infer<typeof CacheClearAllOutput>;
export type CacheGetConfigOutputType = z.infer<typeof CacheGetConfigOutput>;
