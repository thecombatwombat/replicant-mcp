import { z } from "zod";

/**
 * Output for emulator-device list operation
 */
export const EmulatorListOutput = z.object({
  available: z.array(z.string()),
  running: z.array(z.string()),
});

/**
 * Output for emulator-device create operation
 */
export const EmulatorCreateOutput = z.object({
  created: z.string(),
});

/**
 * Output for emulator-device start operation
 */
export const EmulatorStartOutput = z.object({
  started: z.string(),
  emulatorId: z.string(),
  autoSelected: z.literal(true),
});

/**
 * Output for emulator-device kill operation
 */
export const EmulatorKillOutput = z.object({
  killed: z.string(),
});

/**
 * Output for emulator-device wipe operation
 */
export const EmulatorWipeOutput = z.object({
  wiped: z.string(),
});

/**
 * Output for emulator-device snapshot-save operation
 */
export const EmulatorSnapshotSaveOutput = z.object({
  saved: z.string(),
  emulatorId: z.string(),
});

/**
 * Output for emulator-device snapshot-load operation
 */
export const EmulatorSnapshotLoadOutput = z.object({
  loaded: z.string(),
  emulatorId: z.string(),
});

/**
 * Output for emulator-device snapshot-list operation
 */
export const EmulatorSnapshotListOutput = z.object({
  snapshots: z.array(z.string()),
  emulatorId: z.string(),
});

/**
 * Output for emulator-device snapshot-delete operation
 */
export const EmulatorSnapshotDeleteOutput = z.object({
  deleted: z.string(),
  emulatorId: z.string(),
});

/**
 * Union of all emulator-device tool outputs
 */
export const EmulatorDeviceOutput = z.union([
  EmulatorListOutput,
  EmulatorCreateOutput,
  EmulatorStartOutput,
  EmulatorKillOutput,
  EmulatorWipeOutput,
  EmulatorSnapshotSaveOutput,
  EmulatorSnapshotLoadOutput,
  EmulatorSnapshotListOutput,
  EmulatorSnapshotDeleteOutput,
]);

export type EmulatorListOutputType = z.infer<typeof EmulatorListOutput>;
export type EmulatorCreateOutputType = z.infer<typeof EmulatorCreateOutput>;
export type EmulatorStartOutputType = z.infer<typeof EmulatorStartOutput>;
export type EmulatorKillOutputType = z.infer<typeof EmulatorKillOutput>;
export type EmulatorWipeOutputType = z.infer<typeof EmulatorWipeOutput>;
export type EmulatorSnapshotSaveOutputType = z.infer<typeof EmulatorSnapshotSaveOutput>;
export type EmulatorSnapshotLoadOutputType = z.infer<typeof EmulatorSnapshotLoadOutput>;
export type EmulatorSnapshotListOutputType = z.infer<typeof EmulatorSnapshotListOutput>;
export type EmulatorSnapshotDeleteOutputType = z.infer<typeof EmulatorSnapshotDeleteOutput>;
