import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS, ReplicantError, ErrorCode } from "../types/index.js";
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
  let buildResult;
  try {
    buildResult = await context.gradle.build(
      input.operation,
      input.module,
      input.flavor
    );
  } catch (error) {
    // A failed build still has useful output (compiler errors). Cache it under
    // a buildId and rethrow with that id so gradle-get-details can fetch the
    // full errors — same retrieval path as a successful build.
    if (error instanceof ReplicantError && error.code === ErrorCode.BUILD_FAILED) {
      const failureContext = error.context ?? {};
      const buildId = context.cache.generateId("build");
      context.cache.set(
        buildId,
        {
          fullOutput: failureContext.fullOutput ?? "",
          result: failureContext.buildResult ?? {},
          operation: input.operation,
        },
        "build",
        CACHE_TTLS.BUILD_OUTPUT
      );
      throw new ReplicantError(
        ErrorCode.BUILD_FAILED,
        error.message,
        `Fetch full error output: gradle-get-details { id: "${buildId}", detailType: "errors" }`,
        { buildResult: failureContext.buildResult, buildId }
      );
    }
    throw error;
  }

  const { result, fullOutput } = buildResult;
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
