export * from "./cache.js";
export * from "./rtfm.js";
export * from "./adb-device.js";
export * from "./adb-app.js";
export * from "./adb-logcat.js";
export * from "./adb-shell.js";
export * from "./emulator-device.js";
export * from "./gradle-build.js";
export * from "./gradle-test.js";
export * from "./gradle-list.js";
export * from "./gradle-get-details.js";
export * from "./ui-query.js";
export * from "./ui-action.js";
export * from "./ui-capture.js";
export * from "./ui-find.js";

import { cacheToolDefinition } from "./cache.js";
import { rtfmToolDefinition } from "./rtfm.js";
import { adbDeviceToolDefinition } from "./adb-device.js";
import { adbAppToolDefinition } from "./adb-app.js";
import { adbLogcatToolDefinition } from "./adb-logcat.js";
import { adbShellToolDefinition } from "./adb-shell.js";
import { emulatorDeviceToolDefinition } from "./emulator-device.js";
import { gradleBuildToolDefinition } from "./gradle-build.js";
import { gradleTestToolDefinition } from "./gradle-test.js";
import { gradleListToolDefinition } from "./gradle-list.js";
import { gradleGetDetailsToolDefinition } from "./gradle-get-details.js";
import { uiQueryToolDefinition } from "./ui-query.js";
import { uiActionToolDefinition } from "./ui-action.js";
import { uiCaptureToolDefinition } from "./ui-capture.js";

// Single registry of all MCP tool definitions. Consumed by the server at
// registration time, the contract generator, and the token-snapshot
// generator — so adding a tool here is enough to keep all three in sync.
export const ALL_TOOL_DEFINITIONS = [
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
  uiQueryToolDefinition,
  uiActionToolDefinition,
  uiCaptureToolDefinition,
] as const;
