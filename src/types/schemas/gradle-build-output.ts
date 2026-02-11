import { z } from "zod";

/**
 * Output for gradle-build tool
 */
export const GradleBuildOutput = z.object({
  buildId: z.string(),
  summary: z.object({
    success: z.boolean(),
    duration: z.string().optional(),
    warnings: z.number(),
    errors: z.number(),
    apkPath: z.string().optional(),
    tasksExecuted: z.number().optional(),
  }),
});

export type GradleBuildOutputType = z.infer<typeof GradleBuildOutput>;
