import { z } from "zod";
import { ServerContext } from "../server.js";

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

export async function handleEmulatorDeviceTool(
  input: EmulatorDeviceInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  switch (input.operation) {
    case "list": {
      const result = await context.emulator.list();
      return {
        available: result.available,
        running: result.running,
      };
    }

    case "create": {
      if (!input.avdName || !input.device || !input.systemImage) {
        throw new Error("avdName, device, and systemImage are required for create");
      }
      await context.emulator.create(input.avdName, input.device, input.systemImage);
      return { created: input.avdName };
    }

    case "start": {
      if (!input.avdName) {
        throw new Error("avdName is required for start");
      }
      const emulatorId = await context.emulator.start(input.avdName);

      // Auto-select the started emulator
      const devices = await context.adb.getDevices();
      const device = devices.find((d) => d.id === emulatorId);
      if (device) {
        context.deviceState.setCurrentDevice(device);
      }

      return { started: input.avdName, emulatorId, autoSelected: true };
    }

    case "kill": {
      const emulatorId = input.emulatorId || context.deviceState.getCurrentDevice()?.id;
      if (!emulatorId) {
        throw new Error("emulatorId is required or select an emulator first");
      }
      await context.emulator.kill(emulatorId);

      // Clear device selection if it was the killed emulator
      if (context.deviceState.getCurrentDevice()?.id === emulatorId) {
        context.deviceState.clearCurrentDevice();
      }

      return { killed: emulatorId };
    }

    case "wipe": {
      if (!input.avdName) {
        throw new Error("avdName is required for wipe");
      }
      await context.emulator.wipe(input.avdName);
      return { wiped: input.avdName };
    }

    case "snapshot-save": {
      const emulatorId = input.emulatorId || context.deviceState.getCurrentDevice()?.id;
      if (!emulatorId || !input.snapshotName) {
        throw new Error("emulatorId and snapshotName are required for snapshot-save");
      }
      await context.emulator.snapshotSave(emulatorId, input.snapshotName);
      return { saved: input.snapshotName, emulatorId };
    }

    case "snapshot-load": {
      const emulatorId = input.emulatorId || context.deviceState.getCurrentDevice()?.id;
      if (!emulatorId || !input.snapshotName) {
        throw new Error("emulatorId and snapshotName are required for snapshot-load");
      }
      await context.emulator.snapshotLoad(emulatorId, input.snapshotName);
      return { loaded: input.snapshotName, emulatorId };
    }

    case "snapshot-list": {
      const emulatorId = input.emulatorId || context.deviceState.getCurrentDevice()?.id;
      if (!emulatorId) {
        throw new Error("emulatorId is required for snapshot-list");
      }
      const snapshots = await context.emulator.snapshotList(emulatorId);
      return { snapshots, emulatorId };
    }

    case "snapshot-delete": {
      const emulatorId = input.emulatorId || context.deviceState.getCurrentDevice()?.id;
      if (!emulatorId || !input.snapshotName) {
        throw new Error("emulatorId and snapshotName are required for snapshot-delete");
      }
      await context.emulator.snapshotDelete(emulatorId, input.snapshotName);
      return { deleted: input.snapshotName, emulatorId };
    }

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
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
