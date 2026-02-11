import { z } from "zod";
import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode } from "../types/index.js";

export const emulatorDeviceInputSchema = z.object({
  operation: z.enum([
    "list",
    "create",
    "start",
    "kill",
    "wipe",
    "snapshot-save",
    "snapshot-load",
    "snapshot-list",
    "snapshot-delete",
  ]),
  avdName: z.string().optional(),
  device: z.string().optional(),
  systemImage: z.string().optional(),
  snapshotName: z.string().optional(),
  emulatorId: z.string().optional(),
});

export type EmulatorDeviceInput = z.infer<typeof emulatorDeviceInputSchema>;

async function handleList(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  const result = await context.emulator.list();
  return { available: result.available, running: result.running };
}

async function handleCreate(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  if (!input.avdName || !input.device || !input.systemImage) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "avdName, device, and systemImage are required for create",
      "Provide all three parameters: avdName, device, and systemImage",
    );
  }
  await context.emulator.create(input.avdName, input.device, input.systemImage);
  return { created: input.avdName };
}

async function handleStart(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  if (!input.avdName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "avdName is required for start",
      "Provide the AVD name to start",
    );
  }
  const emulatorId = await context.emulator.start(input.avdName);

  const devices = await context.adb.getDevices();
  const device = devices.find((d) => d.id === emulatorId);
  if (device) {
    context.deviceState.setCurrentDevice(device);
  }

  return { started: input.avdName, emulatorId, autoSelected: true };
}

async function handleKill(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  const emulatorId = input.emulatorId || context.deviceState.getCurrentDevice()?.id;
  if (!emulatorId) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "emulatorId is required or select an emulator first",
      "Use emulator-device list to see running emulators, or provide emulatorId",
    );
  }
  await context.emulator.kill(emulatorId);

  if (context.deviceState.getCurrentDevice()?.id === emulatorId) {
    context.deviceState.clearCurrentDevice();
  }

  return { killed: emulatorId };
}

async function handleWipe(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  if (!input.avdName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "avdName is required for wipe",
      "Provide the AVD name to wipe",
    );
  }
  await context.emulator.wipe(input.avdName);
  return { wiped: input.avdName };
}

function resolveEmulatorId(input: EmulatorDeviceInput, context: ServerContext): string {
  const emulatorId = input.emulatorId || context.deviceState.getCurrentDevice()?.id;
  if (!emulatorId) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      `emulatorId is required for ${input.operation}`,
      "Use emulator-device list to see running emulators, or provide emulatorId",
    );
  }
  return emulatorId;
}

async function handleSnapshotSave(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  const emulatorId = resolveEmulatorId(input, context);
  if (!input.snapshotName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "snapshotName is required for snapshot-save",
      "Provide the snapshot name to save",
    );
  }
  await context.emulator.snapshotSave(emulatorId, input.snapshotName);
  return { saved: input.snapshotName, emulatorId };
}

async function handleSnapshotLoad(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  const emulatorId = resolveEmulatorId(input, context);
  if (!input.snapshotName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "snapshotName is required for snapshot-load",
      "Provide the snapshot name to load",
    );
  }
  await context.emulator.snapshotLoad(emulatorId, input.snapshotName);
  return { loaded: input.snapshotName, emulatorId };
}

async function handleSnapshotList(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  const emulatorId = resolveEmulatorId(input, context);
  const snapshots = await context.emulator.snapshotList(emulatorId);
  return { snapshots, emulatorId };
}

async function handleSnapshotDelete(input: EmulatorDeviceInput, context: ServerContext): Promise<Record<string, unknown>> {
  const emulatorId = resolveEmulatorId(input, context);
  if (!input.snapshotName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "snapshotName is required for snapshot-delete",
      "Provide the snapshot name to delete",
    );
  }
  await context.emulator.snapshotDelete(emulatorId, input.snapshotName);
  return { deleted: input.snapshotName, emulatorId };
}

const operations: Record<string, (input: EmulatorDeviceInput, context: ServerContext) => Promise<Record<string, unknown>>> = {
  list: handleList,
  create: handleCreate,
  start: handleStart,
  kill: handleKill,
  wipe: handleWipe,
  "snapshot-save": handleSnapshotSave,
  "snapshot-load": handleSnapshotLoad,
  "snapshot-list": handleSnapshotList,
  "snapshot-delete": handleSnapshotDelete,
};

export async function handleEmulatorDeviceTool(
  input: EmulatorDeviceInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const handler = operations[input.operation];
  if (!handler) {
    throw new ReplicantError(
      ErrorCode.INVALID_OPERATION,
      `Unknown operation: ${input.operation}`,
      "Valid operations: list, create, start, kill, wipe, snapshot-save, snapshot-load, snapshot-list, snapshot-delete",
    );
  }
  return handler(input, context);
}

export const emulatorDeviceToolDefinition = {
  name: "emulator-device",
  description: "Manage Android emulators. Operations: list, create, start, kill, wipe, snapshot-*",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: [
          "list",
          "create",
          "start",
          "kill",
          "wipe",
          "snapshot-save",
          "snapshot-load",
          "snapshot-list",
          "snapshot-delete",
        ],
      },
      avdName: { type: "string", description: "AVD name" },
      device: { type: "string", description: "Device profile (e.g., 'pixel_7')" },
      systemImage: { type: "string", description: "System image" },
      snapshotName: { type: "string", description: "Snapshot name" },
      emulatorId: { type: "string", description: "Running emulator ID" },
    },
    required: ["operation"],
  },
};
