import { z } from "zod";

/**
 * Output for adb-logcat tool
 */
export const AdbLogcatOutput = z.object({
  logId: z.string(),
  summary: z.object({
    lineCount: z.number(),
    errorCount: z.number(),
    warnCount: z.number(),
  }),
  preview: z.string(),
  deviceId: z.string(),
});

export type AdbLogcatOutputType = z.infer<typeof AdbLogcatOutput>;
