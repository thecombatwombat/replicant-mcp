import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";

export const adbAppInputSchema = z.object({
  operation: z.enum(["install", "uninstall", "launch", "stop", "clear-data", "list"]),
  apkPath: z.string().optional(),
  packageName: z.string().optional(),
  // List operation options
  limit: z.number().min(1).max(100).optional(),
  filter: z.string().optional(),
  offset: z.number().min(0).optional(),
});

export type AdbAppInput = z.infer<typeof adbAppInputSchema>;

export async function handleAdbAppTool(
  input: AdbAppInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;

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
      const allPackages = await context.adb.getPackages(deviceId);
      const limit = input.limit ?? 20;
      const offset = input.offset ?? 0;
      const filter = input.filter?.toLowerCase();

      // Apply filter if provided
      const filtered = filter
        ? allPackages.filter((pkg) => pkg.toLowerCase().includes(filter))
        : allPackages;

      // Paginate
      const paginated = filtered.slice(offset, offset + limit);
      const hasMore = offset + limit < filtered.length;

      // Cache full list for subsequent requests
      const cacheId = context.cache.generateId("app-list");
      context.cache.set(
        cacheId,
        { packages: filtered, deviceId, filter: filter || null },
        "app-list",
        CACHE_TTLS.APP_LIST
      );

      return {
        packages: paginated,
        count: paginated.length,
        totalCount: filtered.length,
        hasMore,
        offset,
        limit,
        cacheId,
        deviceId,
      };
    }

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const adbAppToolDefinition = {
  name: "adb-app",
  description:
    "Manage applications. Auto-selects device if only one connected. Operations: install, uninstall, launch, stop, clear-data, list.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["install", "uninstall", "launch", "stop", "clear-data", "list"],
      },
      apkPath: { type: "string", description: "Path to APK file (for install)" },
      packageName: { type: "string", description: "Package name (for other operations)" },
      limit: {
        type: "number",
        description: "Max packages to return (default: 20, max: 100). For list operation.",
      },
      filter: {
        type: "string",
        description: "Filter packages by name (case-insensitive contains). For list operation.",
      },
      offset: {
        type: "number",
        description: "Skip first N packages for pagination. For list operation.",
      },
    },
    required: ["operation"],
  },
};
