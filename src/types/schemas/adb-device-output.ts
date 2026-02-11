import { z } from "zod";

const DeviceSchema = z.object({
  id: z.string(),
  type: z.enum(["emulator", "physical"]),
  name: z.string(),
  status: z.enum(["online", "offline", "booting"]),
});

/**
 * Output for adb-device list operation
 */
export const AdbDeviceListOutput = z.object({
  devices: z.array(DeviceSchema),
  currentDevice: z.string().nullable(),
  autoSelected: z.boolean(),
});

/**
 * Output for adb-device select operation
 */
export const AdbDeviceSelectOutput = z.object({
  selected: DeviceSchema,
});

/**
 * Output for adb-device wait operation
 */
export const AdbDeviceWaitOutput = z.object({
  status: z.literal("device ready"),
  deviceId: z.string(),
});

/**
 * Output for adb-device properties operation
 */
export const AdbDevicePropertiesOutput = z.object({
  deviceId: z.string(),
  summary: z.object({
    model: z.string().optional(),
    manufacturer: z.string().optional(),
    sdkVersion: z.string().optional(),
    androidVersion: z.string().optional(),
    buildId: z.string().optional(),
    device: z.string().optional(),
    product: z.string().optional(),
    hardware: z.string().optional(),
    abiList: z.string().optional(),
  }),
  propertyCount: z.number(),
  cacheId: z.string(),
});

/**
 * Output for adb-device health-check operation
 */
export const AdbDeviceHealthCheckOutput = z.object({
  healthy: z.boolean(),
  environment: z.object({
    sdkPath: z.string().optional(),
    adbPath: z.string().optional(),
    platform: z.string().optional(),
  }),
  adbServerRunning: z.boolean(),
  connectedDevices: z.number(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

/**
 * Union of all adb-device tool outputs
 */
export const AdbDeviceOutput = z.union([
  AdbDeviceListOutput,
  AdbDeviceSelectOutput,
  AdbDeviceWaitOutput,
  AdbDevicePropertiesOutput,
  AdbDeviceHealthCheckOutput,
]);

export type AdbDeviceListOutputType = z.infer<typeof AdbDeviceListOutput>;
export type AdbDeviceSelectOutputType = z.infer<typeof AdbDeviceSelectOutput>;
export type AdbDeviceWaitOutputType = z.infer<typeof AdbDeviceWaitOutput>;
export type AdbDevicePropertiesOutputType = z.infer<typeof AdbDevicePropertiesOutput>;
export type AdbDeviceHealthCheckOutputType = z.infer<typeof AdbDeviceHealthCheckOutput>;
