import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";
import { TestResult } from "../parsers/gradle-output.js";
import {
  saveBaseline,
  loadBaseline,
  clearBaseline,
  compareResults,
  BaselineTestResult,
} from "../services/test-baseline.js";

export const gradleTestInputSchema = z.object({
  operation: z.enum(["unitTest", "connectedTest", "saveBaseline", "clearBaseline"]),
  module: z.string().optional(),
  filter: z.string().optional(),
  taskName: z.string().optional().describe("Task name for baseline operations. Defaults to operation name."),
});

export type GradleTestInput = z.infer<typeof gradleTestInputSchema>;

/**
 * Convert gradle TestResult into BaselineTestResult[] for baseline storage/comparison.
 * Captures both passed and failed test names for accurate regression detection.
 */
export function convertToBaselineResults(result: TestResult): BaselineTestResult[] {
  const results: BaselineTestResult[] = [];

  for (const testName of result.passedTests) {
    results.push({ test: testName, status: "pass" });
  }

  for (const failure of result.failures) {
    results.push({ test: failure.test, status: "fail" });
  }

  return results;
}

async function handleRunTests(
  input: GradleTestInput,
  context: ServerContext,
  operation: "unitTest" | "connectedTest"
): Promise<Record<string, unknown>> {
  const { result, fullOutput } = await context.gradle.test(
    operation,
    input.module,
    input.filter
  );

  // Cache full output for later retrieval
  const testId = context.cache.generateId("test");
  context.cache.set(
    testId,
    { fullOutput, result, operation },
    "test",
    CACHE_TTLS.TEST_RESULTS
  );

  // Check for regressions against baseline
  const effectiveTaskName = input.taskName || operation;
  const baseline = loadBaseline(effectiveTaskName);
  const baselineResults = convertToBaselineResults(result);
  const regressions = baseline ? compareResults(baseline, baselineResults) : [];

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
    regressions,
  };
}

async function handleSaveBaseline(
  input: GradleTestInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  // Run tests first to get current results
  const operation = "unitTest" as const;
  const { result, fullOutput } = await context.gradle.test(
    operation,
    input.module,
    input.filter
  );

  const testId = context.cache.generateId("test");
  context.cache.set(
    testId,
    { fullOutput, result, operation },
    "test",
    CACHE_TTLS.TEST_RESULTS
  );

  const effectiveTaskName = input.taskName || operation;
  const baselineResults = convertToBaselineResults(result);
  saveBaseline(effectiveTaskName, baselineResults);

  return {
    testId,
    summary: {
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      total: result.total,
      duration: result.duration,
    },
    baselineSaved: effectiveTaskName,
    baselineTestCount: baselineResults.length,
  };
}

function handleClearBaseline(input: GradleTestInput): Record<string, unknown> {
  const effectiveTaskName = input.taskName || "unitTest";
  clearBaseline(effectiveTaskName);
  return { baselineCleared: effectiveTaskName };
}

export async function handleGradleTestTool(
  input: GradleTestInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  switch (input.operation) {
    case "unitTest":
    case "connectedTest":
      return handleRunTests(input, context, input.operation);
    case "saveBaseline":
      return handleSaveBaseline(input, context);
    case "clearBaseline":
      return handleClearBaseline(input);
  }
}

export const gradleTestToolDefinition = {
  name: "gradle-test",
  description:
    "Run tests. Operations: unitTest, connectedTest, saveBaseline, clearBaseline. Returns summary with testId. " +
    "When a baseline exists, unitTest/connectedTest auto-detect regressions (previously-passing tests now failing).",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["unitTest", "connectedTest", "saveBaseline", "clearBaseline"],
      },
      module: { type: "string", description: "Module path" },
      filter: { type: "string", description: "Test filter (e.g., '*LoginTest*')" },
      taskName: {
        type: "string",
        description: "Task name for baseline operations. Defaults to operation name.",
      },
    },
    required: ["operation"],
  },
};
