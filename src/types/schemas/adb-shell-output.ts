import { z } from "zod";

/**
 * Output for adb-shell tool
 */
export const AdbShellOutput = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  deviceId: z.string(),
});

export type AdbShellOutputType = z.infer<typeof AdbShellOutput>;
