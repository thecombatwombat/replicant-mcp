import { z } from "zod";

/**
 * Output for gradle-list modules operation
 */
export const GradleListModulesOutput = z.object({
  modules: z.array(z.string()),
});

/**
 * Output for gradle-list variants operation
 */
export const GradleListVariantsOutput = z.object({
  variants: z.array(z.object({
    name: z.string(),
    buildType: z.string(),
    flavors: z.array(z.string()),
  })),
  module: z.string(),
});

/**
 * Output for gradle-list tasks operation
 */
export const GradleListTasksOutput = z.object({
  listId: z.string(),
  summary: z.object({
    totalTasks: z.number(),
    buildTasks: z.array(z.string()),
    testTasks: z.array(z.string()),
    cleanTasks: z.array(z.string()),
  }),
  module: z.string(),
});

/**
 * Union of all gradle-list tool outputs
 */
export const GradleListOutput = z.union([
  GradleListModulesOutput,
  GradleListVariantsOutput,
  GradleListTasksOutput,
]);

export type GradleListModulesOutputType = z.infer<typeof GradleListModulesOutput>;
export type GradleListVariantsOutputType = z.infer<typeof GradleListVariantsOutput>;
export type GradleListTasksOutputType = z.infer<typeof GradleListTasksOutput>;
