import { describe, it, expect } from "vitest";
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
  uiQueryToolDefinition,
  uiActionToolDefinition,
  uiCaptureToolDefinition,
} from "../../src/tools/index.js";

describe("Token budget", () => {
  it("total tool schema + instructions size stays below ceiling", () => {
    const toolDefinitions = [
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
    ];

    const instructions = `Use these tools for Android — never raw adb/gradle/emulator commands. Auto-selects single device. Start: \`adb-device list\`. Docs: \`rtfm\`.`;

    const schemaJson = JSON.stringify(toolDefinitions);
    const totalChars = schemaJson.length + instructions.length;

    // Rough token estimate: ~4 chars per token for JSON schema
    const estimatedTokens = Math.ceil(totalChars / 4);

    // Log actual values for visibility when updating ceiling
    console.log(`Schema chars: ${schemaJson.length}, Instructions chars: ${instructions.length}, Total chars: ${totalChars}, Est. tokens: ${estimatedTokens}`);

    // CEILING: ~22 tokens above measured value (1,678). Tight by design.
    // If this test fails, someone added schema bloat — compress before raising the ceiling.
    const TOKEN_CEILING = 1700;

    expect(estimatedTokens).toBeLessThanOrEqual(TOKEN_CEILING);
  });

  it("should have exactly 14 tool definitions", () => {
    const toolDefinitions = [
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
    ];

    expect(toolDefinitions).toHaveLength(14);
  });
});
