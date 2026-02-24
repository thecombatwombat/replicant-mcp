import { z } from "zod";
import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode } from "../types/index.js";

export const gradleGetDetailsInputSchema = z.object({
  id: z.string(),
  detailType: z.enum(["logs", "errors", "tasks", "all"]).optional().default("all"),
  maxChars: z.number().min(1).optional(),
  summaryOnly: z.boolean().optional(),
  previewChars: z.number().min(1).optional(),
});

export type GradleGetDetailsInput = z.infer<typeof gradleGetDetailsInputSchema>;

type GradleDetailsCacheEntry = {
  fullOutput: string;
  result: Record<string, unknown>;
  operation: string;
};

type TruncateResult = { text: string; truncated: boolean; originalChars: number };

function truncateText(text: string, maxChars?: number): TruncateResult {
  if (!maxChars || text.length <= maxChars) {
    return { text, truncated: false, originalChars: text.length };
  }

  return {
    text: text.slice(0, maxChars),
    truncated: true,
    originalChars: text.length,
  };
}

function summaryFromText(text: string): { lineCount: number; warnCount: number; errorCount: number; charCount: number } {
  return {
    lineCount: text.split("\n").filter(Boolean).length,
    warnCount: (text.match(/\bW\b|^w:/gm) || []).length,
    errorCount: (text.match(/\bE\b|^e:|error:|Error:|FAILED/gm) || []).length,
    charCount: text.length,
  };
}

function buildLogsResponse(
  input: GradleGetDetailsInput,
  fullOutput: string,
  operation: string,
  previewChars: number,
): Record<string, unknown> {
  if (input.summaryOnly) {
    return {
      id: input.id,
      detailType: "logs",
      operation,
      summarized: true,
      summary: summaryFromText(fullOutput),
      preview: fullOutput.slice(0, previewChars),
    };
  }

  const truncated = truncateText(fullOutput, input.maxChars);
  return {
    id: input.id,
    detailType: "logs",
    operation,
    logs: truncated.text,
    truncated: truncated.truncated,
    originalChars: truncated.originalChars,
  };
}

function buildErrorsResponse(
  input: GradleGetDetailsInput,
  fullOutput: string,
  operation: string,
): Record<string, unknown> {
  const errorLines = fullOutput.split("\n").filter(
    (line) =>
      line.includes("error:") ||
      line.includes("Error:") ||
      line.includes("FAILED") ||
      line.startsWith("e:"),
  );
  const truncated = truncateText(errorLines.join("\n"), input.maxChars);

  return {
    id: input.id,
    detailType: "errors",
    operation,
    errors: truncated.text,
    truncated: truncated.truncated,
    originalChars: truncated.originalChars,
    errorCount: errorLines.length,
  };
}

function buildTasksResponse(
  input: GradleGetDetailsInput,
  fullOutput: string,
  operation: string,
): Record<string, unknown> {
  const taskLines = fullOutput.split("\n").filter((line) => line.startsWith("> Task"));

  if (input.summaryOnly) {
    return {
      id: input.id,
      detailType: "tasks",
      operation,
      summarized: true,
      taskCount: taskLines.length,
      tasksPreview: taskLines.slice(0, 10),
    };
  }

  return {
    id: input.id,
    detailType: "tasks",
    operation,
    tasks: taskLines
      .map((line) => {
        const match = line.match(/> Task (:\S+)(?:\s+(.+))?/);
        return match ? { task: match[1], status: match[2] || "executed" } : null;
      })
      .filter(Boolean),
  };
}

function buildAllResponse(
  input: GradleGetDetailsInput,
  fullOutput: string,
  result: Record<string, unknown>,
  operation: string,
  previewChars: number,
): Record<string, unknown> {
  if (input.summaryOnly) {
    return {
      id: input.id,
      detailType: "all",
      operation,
      summarized: true,
      summary: {
        ...summaryFromText(fullOutput),
        resultKeys: Object.keys(result),
      },
      preview: fullOutput.slice(0, previewChars),
    };
  }

  const truncated = truncateText(fullOutput, input.maxChars);
  return {
    id: input.id,
    detailType: "all",
    operation,
    result,
    fullOutput: truncated.text,
    truncated: truncated.truncated,
    originalChars: truncated.originalChars,
  };
}

function getCacheEntry(input: GradleGetDetailsInput, context: ServerContext): GradleDetailsCacheEntry {
  const entry = context.cache.get<GradleDetailsCacheEntry>(input.id);

  if (!entry) {
    throw new ReplicantError(
      ErrorCode.CACHE_MISS,
      `No cached data found for id: ${input.id}`,
      "The cache entry may have expired. Re-run the build/test operation.",
    );
  }

  return entry.data;
}

export async function handleGradleGetDetailsTool(
  input: GradleGetDetailsInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const { fullOutput, result, operation } = getCacheEntry(input, context);
  const previewChars = input.previewChars ?? 400;

  switch (input.detailType) {
    case "logs":
      return buildLogsResponse(input, fullOutput, operation, previewChars);
    case "errors":
      return buildErrorsResponse(input, fullOutput, operation);
    case "tasks":
      return buildTasksResponse(input, fullOutput, operation);

    case "all":
    default:
      return buildAllResponse(input, fullOutput, result, operation, previewChars);
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
      maxChars: {
        type: "number",
        description: "Truncate large text fields to at most this many characters",
      },
      summaryOnly: {
        type: "boolean",
        description: "Return compact summary payload for logs/tasks/all detail types (ignored for errors)",
      },
      previewChars: {
        type: "number",
        description: "For summaryOnly with detailType logs/all: preview length in characters (default: 400)",
      },
    },
    required: ["id"],
  },
};
