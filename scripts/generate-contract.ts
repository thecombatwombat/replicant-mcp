/**
 * Generates a machine-readable JSON contract from tool definitions and output schemas.
 *
 * Usage: tsx scripts/generate-contract.ts
 *
 * Reads input schemas from tool definitions (already JSON Schema) and converts
 * Zod output schemas to JSON Schema using Zod 4's built-in toJSONSchema().
 *
 * Output: docs/contracts/replicant-mcp.contract.json
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// Tool definitions (input schemas are already JSON Schema objects)
import {
  cacheToolDefinition,
  rtfmToolDefinition,
  adbDeviceToolDefinition,
  adbAppToolDefinition,
  adbLogcatToolDefinition,
  adbShellToolDefinition,
  emulatorDeviceToolDefinition,
  gradleBuildToolDefinition,
  gradleTestToolDefinition,
  gradleListToolDefinition,
  gradleGetDetailsToolDefinition,
  uiToolDefinition,
} from "../src/tools/index.js";

// Output schemas (Zod schemas that need conversion)
import {
  CacheGetStatsOutput,
  CacheClearKeyOutput,
  CacheClearAllOutput,
  CacheGetConfigOutput,
} from "../src/types/schemas/cache-output.js";
import { RtfmOutput } from "../src/types/schemas/rtfm-output.js";
import {
  AdbDeviceListOutput,
  AdbDeviceSelectOutput,
  AdbDeviceWaitOutput,
  AdbDevicePropertiesOutput,
  AdbDeviceHealthCheckOutput,
} from "../src/types/schemas/adb-device-output.js";
import {
  AdbAppInstallOutput,
  AdbAppUninstallOutput,
  AdbAppLaunchOutput,
  AdbAppStopOutput,
  AdbAppClearDataOutput,
  AdbAppListOutput,
} from "../src/types/schemas/adb-app-output.js";
import { AdbLogcatOutput } from "../src/types/schemas/adb-logcat-output.js";
import { AdbShellOutput } from "../src/types/schemas/adb-shell-output.js";
import {
  EmulatorListOutput,
  EmulatorCreateOutput,
  EmulatorStartOutput,
  EmulatorKillOutput,
  EmulatorWipeOutput,
  EmulatorSnapshotSaveOutput,
  EmulatorSnapshotLoadOutput,
  EmulatorSnapshotListOutput,
  EmulatorSnapshotDeleteOutput,
} from "../src/types/schemas/emulator-device-output.js";
import { GradleBuildOutput } from "../src/types/schemas/gradle-build-output.js";
import {
  GradleTestRunOutput,
  GradleTestSaveBaselineOutput,
  GradleTestClearBaselineOutput,
} from "../src/types/schemas/gradle-test-output.js";
import {
  GradleListModulesOutput,
  GradleListVariantsOutput,
  GradleListTasksOutput,
} from "../src/types/schemas/gradle-list-output.js";
import {
  GradleGetDetailsLogsOutput,
  GradleGetDetailsErrorsOutput,
  GradleGetDetailsTasksOutput,
  GradleGetDetailsAllOutput,
} from "../src/types/schemas/gradle-get-details-output.js";
import {
  UiDumpFullOutput,
  UiDumpCompactOutput,
  UiFindOutput,
  UiTapOutput,
  UiInputOutput,
  UiScrollOutput,
  UiScreenshotOutput,
  UiAccessibilityCheckOutput,
  UiVisualSnapshotOutput,
} from "../src/types/schemas/ui-output.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dirname, "../docs/contracts/replicant-mcp.contract.json");

type ZodSchema = z.ZodType<unknown>;

function zodToJson(schema: ZodSchema): Record<string, unknown> {
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

interface OutputSchemaMap {
  [name: string]: ZodSchema;
}

interface ToolContract {
  inputSchema: Record<string, unknown>;
  outputSchemas: Record<string, Record<string, unknown>>;
}

interface ToolDef {
  name: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Map of tool name to its named output schemas.
 * Each entry maps a schema name to its Zod schema.
 */
const outputSchemasByTool: Record<string, OutputSchemaMap> = {
  cache: {
    CacheGetStatsOutput,
    CacheClearKeyOutput,
    CacheClearAllOutput,
    CacheGetConfigOutput,
  },
  rtfm: {
    RtfmOutput,
  },
  "adb-device": {
    AdbDeviceListOutput,
    AdbDeviceSelectOutput,
    AdbDeviceWaitOutput,
    AdbDevicePropertiesOutput,
    AdbDeviceHealthCheckOutput,
  },
  "adb-app": {
    AdbAppInstallOutput,
    AdbAppUninstallOutput,
    AdbAppLaunchOutput,
    AdbAppStopOutput,
    AdbAppClearDataOutput,
    AdbAppListOutput,
  },
  "adb-logcat": {
    AdbLogcatOutput,
  },
  "adb-shell": {
    AdbShellOutput,
  },
  "emulator-device": {
    EmulatorListOutput,
    EmulatorCreateOutput,
    EmulatorStartOutput,
    EmulatorKillOutput,
    EmulatorWipeOutput,
    EmulatorSnapshotSaveOutput,
    EmulatorSnapshotLoadOutput,
    EmulatorSnapshotListOutput,
    EmulatorSnapshotDeleteOutput,
  },
  "gradle-build": {
    GradleBuildOutput,
  },
  "gradle-test": {
    GradleTestRunOutput,
    GradleTestSaveBaselineOutput,
    GradleTestClearBaselineOutput,
  },
  "gradle-list": {
    GradleListModulesOutput,
    GradleListVariantsOutput,
    GradleListTasksOutput,
  },
  "gradle-get-details": {
    GradleGetDetailsLogsOutput,
    GradleGetDetailsErrorsOutput,
    GradleGetDetailsTasksOutput,
    GradleGetDetailsAllOutput,
  },
  ui: {
    UiDumpFullOutput,
    UiDumpCompactOutput,
    UiFindOutput,
    UiTapOutput,
    UiInputOutput,
    UiScrollOutput,
    UiScreenshotOutput,
    UiAccessibilityCheckOutput,
    UiVisualSnapshotOutput,
  },
};

const toolDefinitions: ToolDef[] = [
  cacheToolDefinition,
  rtfmToolDefinition,
  adbDeviceToolDefinition,
  adbAppToolDefinition,
  adbLogcatToolDefinition,
  adbShellToolDefinition,
  emulatorDeviceToolDefinition,
  gradleBuildToolDefinition,
  gradleTestToolDefinition,
  gradleListToolDefinition,
  gradleGetDetailsToolDefinition,
  uiToolDefinition,
];

export function generateContract(): Record<string, unknown> {
  const tools: Record<string, ToolContract> = {};

  for (const toolDef of toolDefinitions) {
    const name = toolDef.name;
    const outputSchemas = outputSchemasByTool[name];

    if (!outputSchemas) {
      console.warn(`Warning: No output schemas found for tool "${name}"`);
      continue;
    }

    const convertedOutputs: Record<string, Record<string, unknown>> = {};
    for (const [schemaName, schema] of Object.entries(outputSchemas)) {
      convertedOutputs[schemaName] = zodToJson(schema);
    }

    tools[name] = {
      inputSchema: toolDef.inputSchema,
      outputSchemas: convertedOutputs,
    };
  }

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    tools,
  };
}

// Only write when executed directly (not when imported by check-contracts)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const contract = generateContract();
  mkdirSync(dirname(CONTRACT_PATH), { recursive: true });
  writeFileSync(CONTRACT_PATH, JSON.stringify(contract, null, 2) + "\n");
  console.log(`Contract generated: ${CONTRACT_PATH}`);
  console.log(`Tools: ${Object.keys(contract.tools as Record<string, unknown>).length}`);
}
