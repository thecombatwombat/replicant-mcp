import { z } from "zod";
import { ServerContext } from "../server.js";

export const adbAppInputSchema = z.object({
  operation: z.enum(["install", "uninstall", "launch", "stop", "clear-data", "list"]),
  apkPath: z.string().optional(),
  packageName: z.string().optional(),
});

export type AdbAppInput = z.infer<typeof adbAppInputSchema>;

export async function handleAdbAppTool(
  input: AdbAppInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const deviceId = context.deviceState.requireCurrentDevice().id;

  switch (input.operation) {
    case "install": {
      if (!input.apkPath) {
        throw new Error("apkPath is required for install operation");
      }
      await context.adb.install(deviceId, input.apkPath);
      return { installed: input.apkPath, deviceId };
    }

    case "uninstall": {
      if (!input.packageName) {
        throw new Error("packageName is required for uninstall operation");
      }
      await context.adb.uninstall(deviceId, input.packageName);
      return { uninstalled: input.packageName, deviceId };
    }

    case "launch": {
      if (!input.packageName) {
        throw new Error("packageName is required for launch operation");
      }
      await context.adb.launch(deviceId, input.packageName);
      return { launched: input.packageName, deviceId };
    }

    case "stop": {
      if (!input.packageName) {
        throw new Error("packageName is required for stop operation");
      }
      await context.adb.stop(deviceId, input.packageName);
      return { stopped: input.packageName, deviceId };
    }

    case "clear-data": {
      if (!input.packageName) {
        throw new Error("packageName is required for clear-data operation");
      }
      await context.adb.clearData(deviceId, input.packageName);
      return { cleared: input.packageName, deviceId };
    }

    case "list": {
      const packages = await context.adb.getPackages(deviceId);
      return { packages, count: packages.length, deviceId };
    }

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const adbAppToolDefinition = {
  name: "adb-app",
  description: "Manage applications. Operations: install, uninstall, launch, stop, clear-data, list.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["install", "uninstall", "launch", "stop", "clear-data", "list"],
      },
      apkPath: { type: "string", description: "Path to APK file (for install)" },
      packageName: { type: "string", description: "Package name (for other operations)" },
    },
    required: ["operation"],
  },
};
