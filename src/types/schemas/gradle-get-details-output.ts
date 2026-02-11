import { z } from "zod";

/**
 * Output for gradle-get-details logs detailType
 */
export const GradleGetDetailsLogsOutput = z.object({
  id: z.string(),
  operation: z.string(),
  logs: z.string(),
});

/**
 * Output for gradle-get-details errors detailType
 */
export const GradleGetDetailsErrorsOutput = z.object({
  id: z.string(),
  operation: z.string(),
  errors: z.string(),
  errorCount: z.number(),
});

/**
 * Output for gradle-get-details tasks detailType
 */
export const GradleGetDetailsTasksOutput = z.object({
  id: z.string(),
  operation: z.string(),
  tasks: z.array(z.object({
    task: z.string(),
    status: z.string(),
  }).nullable()),
});

/**
 * Output for gradle-get-details all detailType
 */
export const GradleGetDetailsAllOutput = z.object({
  id: z.string(),
  operation: z.string(),
  result: z.record(z.string(), z.unknown()),
  fullOutput: z.string(),
});

/**
 * Union of all gradle-get-details tool outputs
 */
export const GradleGetDetailsOutput = z.union([
  GradleGetDetailsLogsOutput,
  GradleGetDetailsErrorsOutput,
  GradleGetDetailsTasksOutput,
  GradleGetDetailsAllOutput,
]);

export type GradleGetDetailsLogsOutputType = z.infer<typeof GradleGetDetailsLogsOutput>;
export type GradleGetDetailsErrorsOutputType = z.infer<typeof GradleGetDetailsErrorsOutput>;
export type GradleGetDetailsTasksOutputType = z.infer<typeof GradleGetDetailsTasksOutput>;
export type GradleGetDetailsAllOutputType = z.infer<typeof GradleGetDetailsAllOutput>;
