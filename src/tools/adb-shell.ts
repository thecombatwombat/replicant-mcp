import { z } from "zod";
import { ServerContext } from "../server.js";

export const adbShellInputSchema = z.object({
  command: z.string(),
  timeout: z.number().optional(),
  maxChars: z.number().min(1).optional(),
  summaryOnly: z.boolean().optional(),
  previewChars: z.number().min(1).optional(),
});

export type AdbShellInput = z.infer<typeof adbShellInputSchema>;

export async function handleAdbShellTool(
  input: AdbShellInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;

  const ADB_SHELL_MAX_TIMEOUT = 120_000;
  const timeout = input.timeout ? Math.min(input.timeout, ADB_SHELL_MAX_TIMEOUT) : undefined;
  const result = await context.adb.shell(deviceId, input.command, timeout);

  if (input.summaryOnly) {
    const previewChars = input.previewChars ?? 200;
    return {
      exitCode: result.exitCode,
      deviceId,
      summarized: true,
      stdoutPreview: result.stdout.slice(0, previewChars),
      stderrPreview: result.stderr.slice(0, previewChars),
      originalStdoutChars: result.stdout.length,
      originalStderrChars: result.stderr.length,
    };
  }

  const maxChars = input.maxChars;
  const stdout = maxChars ? result.stdout.slice(0, maxChars) : result.stdout;
  const stderr = maxChars ? result.stderr.slice(0, maxChars) : result.stderr;
  const truncated = !!maxChars && (result.stdout.length > maxChars || result.stderr.length > maxChars);

  const response: Record<string, unknown> = {
    stdout,
    stderr,
    exitCode: result.exitCode,
    deviceId,
    truncated,
  };

  if (maxChars !== undefined) {
    response.originalStdoutChars = result.stdout.length;
    response.originalStderrChars = result.stderr.length;
  }

  return response;
}

export const adbShellToolDefinition = {
  name: "adb-shell",
  description: "Execute shell commands with safety guards.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string" },
      timeout: { type: "number", description: "ms, default: 30000, max: 120000" },
      maxChars: { type: "number", description: "Truncate output to N chars" },
      summaryOnly: { type: "boolean", description: "Compact preview only" },
      previewChars: { type: "number", description: "Preview length (default: 200)" },
    },
    required: ["command"],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
};
