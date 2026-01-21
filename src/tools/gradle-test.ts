import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";

export const gradleTestInputSchema = z.object({
  operation: z.enum(["unitTest", "connectedTest"]),
  module: z.string().optional(),
  filter: z.string().optional(),
});

export type GradleTestInput = z.infer<typeof gradleTestInputSchema>;

export async function handleGradleTestTool(
  input: GradleTestInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const { result, fullOutput } = await context.gradle.test(
    input.operation,
    input.module,
    input.filter
  );

  // Cache full output for later retrieval
  const testId = context.cache.generateId("test");
  context.cache.set(
    testId,
    { fullOutput, result, operation: input.operation },
    "test",
    CACHE_TTLS.TEST_RESULTS
  );

  return {
    testId,
    summary: {
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      total: result.total,
      duration: result.duration,
    },
    failures: result.failures,
  };
}

export const gradleTestToolDefinition = {
  name: "gradle-test",
  description: "Run tests. Operations: unitTest, connectedTest. Returns summary with testId.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["unitTest", "connectedTest"],
      },
      module: { type: "string", description: "Module path" },
      filter: { type: "string", description: "Test filter (e.g., '*LoginTest*')" },
    },
    required: ["operation"],
  },
};
