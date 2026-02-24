import { z } from "zod";

/**
 * Output for gradle-get-details logs detailType
 */
export const GradleGetDetailsLogsOutput = z.object({
  id: z.string(),
  detailType: z.literal("logs"),
  operation: z.string(),
  logs: z.string().optional(),
  summarized: z.boolean().optional(),
  summary: z.object({
    lineCount: z.number(),
    warnCount: z.number(),
    errorCount: z.number(),
    charCount: z.number(),
  }).optional(),
  preview: z.string().optional(),
  truncated: z.boolean().optional(),
  originalChars: z.number().optional(),
}).refine((data) => data.logs !== undefined || data.summary !== undefined, {
  message: "logs detail output must include logs or summary",
});

/**
 * Output for gradle-get-details errors detailType
 */
export const GradleGetDetailsErrorsOutput = z.object({
  id: z.string(),
  detailType: z.literal("errors"),
  operation: z.string(),
  errors: z.string(),
  errorCount: z.number(),
  summarized: z.boolean().optional(),
  truncated: z.boolean().optional(),
  originalChars: z.number().optional(),
});

/**
 * Output for gradle-get-details tasks detailType
 */
export const GradleGetDetailsTasksOutput = z.object({
  id: z.string(),
  detailType: z.literal("tasks"),
  operation: z.string(),
  tasks: z.array(z.object({
    task: z.string(),
    status: z.string(),
  }).nullable()).optional(),
  summarized: z.boolean().optional(),
  taskCount: z.number().optional(),
  tasksPreview: z.array(z.string()).optional(),
}).refine((data) => data.tasks !== undefined || data.taskCount !== undefined, {
  message: "tasks detail output must include tasks or taskCount",
});

/**
 * Output for gradle-get-details all detailType
 */
export const GradleGetDetailsAllOutput = z.object({
  id: z.string(),
  detailType: z.literal("all"),
  operation: z.string(),
  result: z.record(z.string(), z.unknown()).optional(),
  fullOutput: z.string().optional(),
  summarized: z.boolean().optional(),
  summary: z.object({
    lineCount: z.number(),
    warnCount: z.number(),
    errorCount: z.number(),
    charCount: z.number(),
    resultKeys: z.array(z.string()),
  }).optional(),
  preview: z.string().optional(),
  truncated: z.boolean().optional(),
  originalChars: z.number().optional(),
}).refine((data) => data.fullOutput !== undefined || data.summary !== undefined, {
  message: "all detail output must include fullOutput or summary",
});

/**
 * Union of all gradle-get-details tool outputs
 */
// Discriminator is explicit on each variant for clearer validation errors and runtime narrowing.
// Keep per-variant refine guards because they enforce summary-vs-full payload requirements.
export const GradleGetDetailsOutput = z.discriminatedUnion("detailType", [
  GradleGetDetailsLogsOutput,
  GradleGetDetailsErrorsOutput,
  GradleGetDetailsTasksOutput,
  GradleGetDetailsAllOutput,
]);

export type GradleGetDetailsLogsOutputType = z.infer<typeof GradleGetDetailsLogsOutput>;
export type GradleGetDetailsErrorsOutputType = z.infer<typeof GradleGetDetailsErrorsOutput>;
export type GradleGetDetailsTasksOutputType = z.infer<typeof GradleGetDetailsTasksOutput>;
export type GradleGetDetailsAllOutputType = z.infer<typeof GradleGetDetailsAllOutput>;
