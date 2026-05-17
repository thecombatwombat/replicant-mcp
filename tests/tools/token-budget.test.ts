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

    // CEILING: ~30 tokens above measured value. Tight by design.
    // If this test fails, someone added schema bloat — compress before raising the ceiling.
    // History:
    //   1700 → 2070: MCP annotations on all 14 tools.
    //   2070 → 2150: schemas auto-derived via z.toJSONSchema() (THE-95). Strict-mode
    //                enforcement moved to runtime (additionalProperties stripped from
    //                wire payload to offset bloat), but descriptions on numeric/boolean
    //                fields are now preserved automatically from Zod schemas, adding a
    //                consistent +50–80 tokens across tools.
    //   2150 → 2200: ui-action gains a selector field (THE-99). Five optional
    //                sub-keys (resourceId/text/textContains/className/nearestTo)
    //                cost ~20 tokens; descriptions on the field itself were trimmed
    //                to absorb most of it.
    //   2200 → 2600: COMPUTER-USE part 1 (THE-105..THE-111). ui-query gains
    //                interactiveOnly + selector.rank; ui-action gains
    //                imageX/imageY/screenshotId + selector.rank; both grew
    //                describe text materially. Schemas auto-derive from Zod
    //                so every describe lands in the wire schema.
    const TOKEN_CEILING = 2600;

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
