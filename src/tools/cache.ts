import { z } from "zod";
import { CacheManager } from "../services/index.js";

export const cacheInputSchema = z.object({
  operation: z.enum(["get-stats", "clear", "get-config", "set-config"]),
  key: z.string().optional(),
  config: z.object({
    maxEntries: z.number().optional(),
    maxEntrySizeBytes: z.number().optional(),
    defaultTtlMs: z.number().optional(),
  }).optional(),
});

export type CacheInput = z.infer<typeof cacheInputSchema>;

export async function handleCacheTool(
  input: CacheInput,
  cache: CacheManager
): Promise<Record<string, unknown>> {
  switch (input.operation) {
    case "get-stats":
      return { stats: cache.getStats() };

    case "clear":
      if (input.key) {
        cache.clear(input.key);
        return { cleared: input.key };
      } else {
        cache.clearAll();
        return { cleared: "all" };
      }

    case "get-config":
      return { config: cache.getConfig() };

    case "set-config":
      if (input.config) {
        cache.setConfig(input.config);
      }
      return { config: cache.getConfig() };

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const cacheToolDefinition = {
  name: "cache",
  description: "Manage the cache. Operations: get-stats, clear, get-config, set-config. See rtfm for details.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["get-stats", "clear", "get-config", "set-config"],
      },
      key: { type: "string", description: "Specific cache key to clear" },
      config: {
        type: "object",
        properties: {
          maxEntries: { type: "number" },
          maxEntrySizeBytes: { type: "number" },
          defaultTtlMs: { type: "number" },
        },
      },
    },
    required: ["operation"],
  },
};
