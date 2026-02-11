import { z } from "zod";

const TestFailureSchema = z.object({
  test: z.string(),
  message: z.string(),
});

const RegressionSchema = z.object({
  test: z.string(),
  previousStatus: z.string(),
  currentStatus: z.string(),
});

/**
 * Output for gradle-test unitTest/connectedTest operations
 */
export const GradleTestRunOutput = z.object({
  testId: z.string(),
  summary: z.object({
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    total: z.number(),
    duration: z.string().optional(),
  }),
  failures: z.array(TestFailureSchema),
  regressions: z.array(RegressionSchema).optional(),
});

/**
 * Output for gradle-test saveBaseline operation
 */
export const GradleTestSaveBaselineOutput = z.object({
  testId: z.string(),
  summary: z.object({
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    total: z.number(),
    duration: z.string().optional(),
  }),
  baselineSaved: z.string(),
  baselineTestCount: z.number(),
});

/**
 * Output for gradle-test clearBaseline operation
 */
export const GradleTestClearBaselineOutput = z.object({
  baselineCleared: z.string(),
});

/**
 * Union of all gradle-test tool outputs
 */
export const GradleTestOutput = z.union([
  GradleTestRunOutput,
  GradleTestSaveBaselineOutput,
  GradleTestClearBaselineOutput,
]);

export type GradleTestRunOutputType = z.infer<typeof GradleTestRunOutput>;
export type GradleTestSaveBaselineOutputType = z.infer<typeof GradleTestSaveBaselineOutput>;
export type GradleTestClearBaselineOutputType = z.infer<typeof GradleTestClearBaselineOutput>;
