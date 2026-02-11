import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS, ReplicantError, ErrorCode } from "../types/index.js";

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

async function handleInstall(input: AdbAppInput, deviceId: string, context: ServerContext): Promise<Record<string, unknown>> {
  if (!input.apkPath) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "apkPath is required for install operation",
      "Provide the path to the APK file to install",
    );
  }
  await context.adb.install(deviceId, input.apkPath);
  return { installed: input.apkPath, deviceId };
}

async function handleUninstall(input: AdbAppInput, deviceId: string, context: ServerContext): Promise<Record<string, unknown>> {
  if (!input.packageName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "packageName is required for uninstall operation",
      "Provide the package name to uninstall",
    );
  }
  await context.adb.uninstall(deviceId, input.packageName);
  return { uninstalled: input.packageName, deviceId };
}

async function handleLaunch(input: AdbAppInput, deviceId: string, context: ServerContext): Promise<Record<string, unknown>> {
  if (!input.packageName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "packageName is required for launch operation",
      "Provide the package name to launch",
    );
  }
  await context.adb.launch(deviceId, input.packageName);
  return { launched: input.packageName, deviceId };
}

async function handleStop(input: AdbAppInput, deviceId: string, context: ServerContext): Promise<Record<string, unknown>> {
  if (!input.packageName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "packageName is required for stop operation",
      "Provide the package name to stop",
    );
  }
  await context.adb.stop(deviceId, input.packageName);
  return { stopped: input.packageName, deviceId };
}

async function handleClearData(input: AdbAppInput, deviceId: string, context: ServerContext): Promise<Record<string, unknown>> {
  if (!input.packageName) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "packageName is required for clear-data operation",
      "Provide the package name to clear data for",
    );
  }
  await context.adb.clearData(deviceId, input.packageName);
  return { cleared: input.packageName, deviceId };
}

async function handleList(input: AdbAppInput, deviceId: string, context: ServerContext): Promise<Record<string, unknown>> {
  const allPackages = await context.adb.getPackages(deviceId);
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const filter = input.filter?.toLowerCase();

  const filtered = filter
    ? allPackages.filter((pkg) => pkg.toLowerCase().includes(filter))
    : allPackages;

  const paginated = filtered.slice(offset, offset + limit);
  const hasMore = offset + limit < filtered.length;

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

type AppHandler = (input: AdbAppInput, deviceId: string, context: ServerContext) => Promise<Record<string, unknown>>;

const operations: Record<string, AppHandler> = {
  install: handleInstall,
  uninstall: handleUninstall,
  launch: handleLaunch,
  stop: handleStop,
  "clear-data": handleClearData,
  list: handleList,
};

export async function handleAdbAppTool(
  input: AdbAppInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const handler = operations[input.operation];
  if (!handler) {
    throw new ReplicantError(
      ErrorCode.INVALID_OPERATION,
      `Unknown operation: ${input.operation}`,
      "Valid operations: install, uninstall, launch, stop, clear-data, list",
    );
  }
  return handler(input, device.id, context);
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
