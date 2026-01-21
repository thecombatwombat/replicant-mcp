import { z } from "zod";
import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode } from "../types/index.js";

export const gradleGetDetailsInputSchema = z.object({
  id: z.string(),
  detailType: z.enum(["logs", "errors", "tasks", "all"]).optional().default("all"),
});

export type GradleGetDetailsInput = z.infer<typeof gradleGetDetailsInputSchema>;

export async function handleGradleGetDetailsTool(
  input: GradleGetDetailsInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const entry = context.cache.get<{
    fullOutput: string;
    result: Record<string, unknown>;
    operation: string;
  }>(input.id);

  if (!entry) {
    throw new ReplicantError(
      ErrorCode.CACHE_MISS,
      `No cached data found for id: ${input.id}`,
      "The cache entry may have expired. Re-run the build/test operation."
    );
  }

  const { fullOutput, result, operation } = entry.data;

  switch (input.detailType) {
    case "logs":
      return {
        id: input.id,
        operation,
        logs: fullOutput,
      };

    case "errors": {
      // Extract error lines
      const lines = fullOutput.split("\n");
      const errorLines = lines.filter(
        (line) =>
          line.includes("error:") ||
          line.includes("Error:") ||
          line.includes("FAILED") ||
          line.startsWith("e:")
      );
      return {
        id: input.id,
        operation,
        errors: errorLines.join("\n"),
        errorCount: errorLines.length,
      };
    }

    case "tasks": {
      // Extract task execution info
      const lines = fullOutput.split("\n");
      const taskLines = lines.filter((line) => line.startsWith("> Task"));
      return {
        id: input.id,
        operation,
        tasks: taskLines.map((line) => {
          const match = line.match(/> Task (:\S+)(?:\s+(.+))?/);
          return match ? { task: match[1], status: match[2] || "executed" } : null;
        }).filter(Boolean),
      };
    }

    case "all":
    default:
      return {
        id: input.id,
        operation,
        result,
        fullOutput,
      };
  }
}

export const gradleGetDetailsToolDefinition = {
  name: "gradle-get-details",
  description: "Fetch full output for a previous build/test by ID.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Build or test ID from previous operation" },
      detailType: {
        type: "string",
        enum: ["logs", "errors", "tasks", "all"],
        description: "Type of details to retrieve",
      },
    },
    required: ["id"],
  },
};
