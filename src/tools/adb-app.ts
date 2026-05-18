import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS, ReplicantError, ErrorCode } from "../types/index.js";
import { numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

// String→string record that also accepts a JSON-string encoding. We can't
// reuse `jsonObjectInput` because that one is strict-keyed; extras keys are
// caller-supplied so we need an open record.
const extrasInput = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  },
  z.record(z.string(), z.string()),
);

export const adbAppInputSchema = toolSchema({
  operation: z.enum([
    "install",
    "uninstall",
    "launch",
    "stop",
    "clear-data",
    "list",
    "start-intent",
  ]),
  apkPath: z.string().optional().describe("APK path"),
  packageName: z.string().optional(),
  limit: numberInput({ min: 1, max: 100 })
    .optional()
    .describe("Default: 20, max: 100"),
  filter: z.string().optional().describe("Filter by name (case-insensitive)"),
  offset: numberInput({ min: 0 }).optional().describe("Pagination offset"),
  // CU-2 (THE-106): typed-intent fields for `start-intent`. Each field is
  // validated by the adapter before any argv is built — no raw shell payload
  // is constructed from these values, so URLs and JSON-shaped extras flow
  // through without tripping the metacharacter guard.
  action: z
    .string()
    .optional()
    .describe("Intent action (e.g., android.intent.action.VIEW)"),
  data: z.string().optional().describe("Intent data URI"),
  component: z
    .string()
    .optional()
    .describe("Component spec (pkg/.Activity or pkg/pkg.Activity)"),
  extras: extrasInput
    .optional()
    .describe("String extras as key/value pairs (--es key value)"),
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

async function handleStartIntent(
  input: AdbAppInput,
  deviceId: string,
  context: ServerContext,
): Promise<Record<string, unknown>> {
  if (!input.action) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "action is required for start-intent operation",
      "Provide an intent action like android.intent.action.VIEW",
    );
  }
  const result = await context.adb.startIntent(deviceId, {
    action: input.action,
    data: input.data,
    package: input.packageName,
    component: input.component,
    extras: input.extras,
  });
  return {
    intentStarted: {
      action: input.action,
      data: input.data,
      package: input.packageName,
      component: input.component,
      extras: input.extras,
    },
    status: result.status,
    ok: result.ok,
    raw: result.raw,
    deviceId,
  };
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
  "start-intent": handleStartIntent,
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
      "Valid operations: install, uninstall, launch, stop, clear-data, list, start-intent",
    );
  }
  return handler(input, device.id, context);
}

export const adbAppToolDefinition = {
  name: "adb-app",
  description: "Manage applications. start-intent fires a typed `am start` (URLs with & are safe).",
  inputSchema: toMcpJsonSchema(adbAppInputSchema),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};
