import { z } from "zod";

/**
 * Output for adb-shell tool
 */
export const AdbShellOutput = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  deviceId: z.string(),
  truncated: z.boolean().optional(),
  summarized: z.boolean().optional(),
  stdoutPreview: z.string().optional(),
  stderrPreview: z.string().optional(),
  originalStdoutChars: z.number().optional(),
  originalStderrChars: z.number().optional(),
});

export type AdbShellOutputType = z.infer<typeof AdbShellOutput>;
