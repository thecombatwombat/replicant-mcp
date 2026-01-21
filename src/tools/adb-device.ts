import { z } from "zod";
import { ServerContext } from "../server.js";

export const adbDeviceInputSchema = z.object({
  operation: z.enum(["list", "select", "wait", "properties", "health-check"]),
  deviceId: z.string().optional(),
});

export type AdbDeviceInput = z.infer<typeof adbDeviceInputSchema>;

export async function handleAdbDeviceTool(
  input: AdbDeviceInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  switch (input.operation) {
    case "list": {
      const devices = await context.adb.getDevices();
      context.deviceState.autoSelectIfSingle(devices);
      const current = context.deviceState.getCurrentDevice();
      return {
        devices,
        currentDevice: current?.id || null,
        autoSelected: devices.length === 1,
      };
    }

    case "select": {
      if (!input.deviceId) {
        throw new Error("deviceId is required for select operation");
      }
      const devices = await context.adb.getDevices();
      const device = devices.find((d) => d.id === input.deviceId);
      if (!device) {
        throw new Error(`Device ${input.deviceId} not found`);
      }
      context.deviceState.setCurrentDevice(device);
      return { selected: device };
    }

    case "wait": {
      const deviceId = input.deviceId || context.deviceState.getCurrentDevice()?.id;
      if (!deviceId) {
        throw new Error("No device selected. Call with deviceId or select a device first.");
      }
      await context.adb.waitForDevice(deviceId);
      return { status: "device ready", deviceId };
    }

    case "properties": {
      const deviceId = input.deviceId || context.deviceState.requireCurrentDevice().id;
      const props = await context.adb.getProperties(deviceId);
      return {
        deviceId,
        properties: {
          model: props["ro.product.model"],
          manufacturer: props["ro.product.manufacturer"],
          sdkVersion: props["ro.build.version.sdk"],
          androidVersion: props["ro.build.version.release"],
          buildId: props["ro.build.id"],
        },
        allProperties: props,
      };
    }

    case "health-check": {
      const env = await context.environment.detect();
      let adbServerRunning = false;
      let connectedDevices = 0;
      const warnings: string[] = [];
      const errors: string[] = [];

      if (!env.isValid) {
        errors.push(...env.issues);
      } else {
        // Test adb server
        try {
          const devices = await context.adb.getDevices();
          adbServerRunning = true;
          connectedDevices = devices.length;

          if (devices.length === 0) {
            warnings.push("No devices connected. Start an emulator or connect a USB device.");
          }
        } catch (e) {
          errors.push("adb server not responding. Run 'adb kill-server && adb start-server'");
        }
      }

      return {
        healthy: errors.length === 0,
        environment: {
          sdkPath: env.sdkPath,
          adbPath: env.adbPath,
          platform: env.platform,
        },
        adbServerRunning,
        connectedDevices,
        warnings,
        errors,
      };
    }

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const adbDeviceToolDefinition = {
  name: "adb-device",
  description: "Manage device connections. Operations: list, select, wait, properties, health-check.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "select", "wait", "properties", "health-check"],
      },
      deviceId: { type: "string", description: "Device ID for select/wait/properties" },
    },
    required: ["operation"],
  },
};
