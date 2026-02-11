import { z } from "zod";

/**
 * Output for adb-app install operation
 */
export const AdbAppInstallOutput = z.object({
  installed: z.string(),
  deviceId: z.string(),
});

/**
 * Output for adb-app uninstall operation
 */
export const AdbAppUninstallOutput = z.object({
  uninstalled: z.string(),
  deviceId: z.string(),
});

/**
 * Output for adb-app launch operation
 */
export const AdbAppLaunchOutput = z.object({
  launched: z.string(),
  deviceId: z.string(),
});

/**
 * Output for adb-app stop operation
 */
export const AdbAppStopOutput = z.object({
  stopped: z.string(),
  deviceId: z.string(),
});

/**
 * Output for adb-app clear-data operation
 */
export const AdbAppClearDataOutput = z.object({
  cleared: z.string(),
  deviceId: z.string(),
});

/**
 * Output for adb-app list operation
 */
export const AdbAppListOutput = z.object({
  packages: z.array(z.string()),
  count: z.number(),
  totalCount: z.number(),
  hasMore: z.boolean(),
  offset: z.number(),
  limit: z.number(),
  cacheId: z.string(),
  deviceId: z.string(),
});

/**
 * Union of all adb-app tool outputs
 */
export const AdbAppOutput = z.union([
  AdbAppInstallOutput,
  AdbAppUninstallOutput,
  AdbAppLaunchOutput,
  AdbAppStopOutput,
  AdbAppClearDataOutput,
  AdbAppListOutput,
]);

export type AdbAppInstallOutputType = z.infer<typeof AdbAppInstallOutput>;
export type AdbAppUninstallOutputType = z.infer<typeof AdbAppUninstallOutput>;
export type AdbAppLaunchOutputType = z.infer<typeof AdbAppLaunchOutput>;
export type AdbAppStopOutputType = z.infer<typeof AdbAppStopOutput>;
export type AdbAppClearDataOutputType = z.infer<typeof AdbAppClearDataOutput>;
export type AdbAppListOutputType = z.infer<typeof AdbAppListOutput>;
