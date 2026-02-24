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

  const result = await context.adb.shell(deviceId, input.command, input.timeout);

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
  description: "Execute shell commands with safety guards. Auto-selects device if only one connected. Dangerous commands are blocked.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
      timeout: { type: "number", description: "Timeout in ms (default: 30s, max: 120s)" },
      maxChars: { type: "number", description: "Truncate stdout/stderr to at most this many characters" },
      summaryOnly: { type: "boolean", description: "Return only compact previews and counts, omitting full stdout/stderr" },
      previewChars: { type: "number", description: "For summaryOnly: preview length in characters (default: 200)" },
    },
    required: ["command"],
  },
};
