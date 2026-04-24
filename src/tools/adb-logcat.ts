import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";
import { numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

export const adbLogcatInputSchema = toolSchema({
  lines: numberInput().optional().default(100).describe("Default: 100"),
  package: z.string().optional(),
  tags: z.array(z.string()).optional(),
  level: z.enum(["verbose", "debug", "info", "warn", "error"]).optional(),
  rawFilter: z.string().optional(),
  since: z.string().optional().describe("e.g., '01-20 15:30:00.000'"),
});

export type AdbLogcatInput = z.infer<typeof adbLogcatInputSchema>;

function buildLogcatFilter(input: AdbLogcatInput): string | undefined {
  if (input.rawFilter) return input.rawFilter;
  if (!input.tags && !input.level) return undefined;

  const levelMap: Record<string, string> = {
    verbose: "V",
    debug: "D",
    info: "I",
    warn: "W",
    error: "E",
  };
  const levelChar = input.level ? levelMap[input.level] : "V";

  if (input.tags) {
    return input.tags.map((tag) => `${tag}:${levelChar}`).join(" ") + " *:S";
  }
  return `*:${levelChar}`;
}

export async function handleAdbLogcatTool(
  input: AdbLogcatInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;

  const filter = buildLogcatFilter(input);

  const output = await context.adb.logcat(deviceId, {
    lines: input.lines,
    filter,
    since: input.since,
    package: input.package,
  });

  const logId = context.cache.generateId("logcat");
  context.cache.set(logId, { output, deviceId, filter }, "logcat", CACHE_TTLS.LOGCAT);

  const lines = output.split("\n").filter(Boolean);
  const errorCount = lines.filter((l) => l.includes(" E ")).length;
  const warnCount = lines.filter((l) => l.includes(" W ")).length;

  return {
    logId,
    summary: {
      lineCount: lines.length,
      errorCount,
      warnCount,
    },
    preview: lines.slice(0, 20).join("\n"),
    deviceId,
  };
}

export const adbLogcatToolDefinition = {
  name: "adb-logcat",
  description: "Read device logs. Returns summary with logId.",
  inputSchema: toMcpJsonSchema(adbLogcatInputSchema),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
