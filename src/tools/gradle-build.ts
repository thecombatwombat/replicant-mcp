import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";
import { toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

export const gradleBuildInputSchema = toolSchema({
  operation: z.enum(["assembleDebug", "assembleRelease", "bundle"]),
  module: z.string().optional().describe("e.g., ':app'"),
  flavor: z.string().optional(),
});

export type GradleBuildInput = z.infer<typeof gradleBuildInputSchema>;

export async function handleGradleBuildTool(
  input: GradleBuildInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const { result, fullOutput } = await context.gradle.build(
    input.operation,
    input.module,
    input.flavor
  );

  const buildId = context.cache.generateId("build");
  context.cache.set(
    buildId,
    { fullOutput, result, operation: input.operation },
    "build",
    CACHE_TTLS.BUILD_OUTPUT
  );

  return {
    buildId,
    summary: {
      success: result.success,
      duration: result.duration,
      warnings: result.warnings,
      errors: result.errors,
      apkPath: result.apkPath,
      tasksExecuted: result.tasksExecuted,
    },
  };
}

export const gradleBuildToolDefinition = {
  name: "gradle-build",
  description: "Build. Returns summary with buildId.",
  inputSchema: toMcpJsonSchema(gradleBuildInputSchema),
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};
