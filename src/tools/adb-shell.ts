import { z } from "zod";
import { ServerContext } from "../server.js";
import { booleanInput, numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

export const adbShellInputSchema = toolSchema({
  command: z.string(),
  timeout: numberInput().optional().describe("ms, default: 30000, max: 120000"),
  maxChars: numberInput({ min: 1 }).optional().describe("Truncate output to N chars"),
  summaryOnly: booleanInput().optional().describe("Compact preview only"),
  previewChars: numberInput({ min: 1 })
    .optional()
    .describe("Preview length (default: 200)"),
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
  inputSchema: toMcpJsonSchema(adbShellInputSchema),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
};
