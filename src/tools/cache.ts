import { z } from "zod";
import { CacheManager } from "../services/index.js";
import { ReplicantError, ErrorCode } from "../types/index.js";
import { jsonObjectInput, numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

export const cacheInputSchema = toolSchema({
  operation: z.enum(["get-stats", "clear", "get-config", "set-config"]),
  key: z.string().optional().describe("Key to clear (optional)"),
  config: jsonObjectInput({
    maxEntries: numberInput().optional(),
    maxEntrySizeBytes: numberInput().optional(),
    defaultTtlMs: numberInput().optional(),
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
      throw new ReplicantError(
        ErrorCode.INVALID_OPERATION,
        `Unknown operation: ${input.operation}`,
        "Valid operations: get-stats, clear, get-config, set-config",
      );
  }
}

export const cacheToolDefinition = {
  name: "cache",
  description: "Manage the cache. See rtfm for details.",
  inputSchema: toMcpJsonSchema(cacheInputSchema),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};
