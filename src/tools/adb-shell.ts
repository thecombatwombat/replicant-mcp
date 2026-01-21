import { z } from "zod";
import { ServerContext } from "../server.js";

export const adbShellInputSchema = z.object({
  command: z.string(),
  timeout: z.number().optional(),
});

export type AdbShellInput = z.infer<typeof adbShellInputSchema>;

export async function handleAdbShellTool(
  input: AdbShellInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;

  const result = await context.adb.shell(deviceId, input.command, input.timeout);

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    deviceId,
  };
}

export const adbShellToolDefinition = {
  name: "adb-shell",
  description: "Execute shell commands with safety guards. Auto-selects device if only one connected. Dangerous commands are blocked.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
      timeout: { type: "number", description: "Timeout in ms (default: 30s, max: 120s)" },
    },
    required: ["command"],
  },
};
