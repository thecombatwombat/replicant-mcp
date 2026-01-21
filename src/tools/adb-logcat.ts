import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";

export const adbLogcatInputSchema = z.object({
  lines: z.number().optional().default(100),
  package: z.string().optional(),
  tags: z.array(z.string()).optional(),
  level: z.enum(["verbose", "debug", "info", "warn", "error"]).optional(),
  rawFilter: z.string().optional(),
  since: z.string().optional(),
});

export type AdbLogcatInput = z.infer<typeof adbLogcatInputSchema>;

export async function handleAdbLogcatTool(
  input: AdbLogcatInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;

  // Build filter string
  let filter = "";
  if (input.rawFilter) {
    filter = input.rawFilter;
  } else if (input.tags || input.level) {
    const levelMap: Record<string, string> = {
      verbose: "V",
      debug: "D",
      info: "I",
      warn: "W",
      error: "E",
    };
    const levelChar = input.level ? levelMap[input.level] : "V";

    if (input.tags) {
      filter = input.tags.map((tag) => `${tag}:${levelChar}`).join(" ") + " *:S";
    } else {
      filter = `*:${levelChar}`;
    }
  }

  const output = await context.adb.logcat(deviceId, {
    lines: input.lines,
    filter: filter || undefined,
  });

  // Cache the full output and return a summary
  const logId = context.cache.generateId("logcat");
  context.cache.set(logId, { output, deviceId, filter }, "logcat", CACHE_TTLS.UI_TREE);

  // Parse log lines
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
  description: "Read device logs. Returns summary with logId for full output.",
  inputSchema: {
    type: "object",
    properties: {
      lines: { type: "number", description: "Number of lines (default: 100)" },
      package: { type: "string", description: "Filter by package name" },
      tags: { type: "array", items: { type: "string" }, description: "Filter by log tags" },
      level: { type: "string", enum: ["verbose", "debug", "info", "warn", "error"] },
      rawFilter: { type: "string", description: "Raw logcat filter string" },
      since: { type: "string", description: "Time filter (e.g., '5m' or ISO timestamp)" },
    },
  },
};
