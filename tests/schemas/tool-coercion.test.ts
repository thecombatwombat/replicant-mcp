import { describe, it, expect } from "vitest";
import { uiActionInputSchema } from "../../src/tools/ui-action.js";
import { uiQueryInputSchema } from "../../src/tools/ui-query.js";
import { uiCaptureInputSchema } from "../../src/tools/ui-capture.js";
import { adbShellInputSchema } from "../../src/tools/adb-shell.js";
import { adbLogcatInputSchema } from "../../src/tools/adb-logcat.js";
import { adbAppInputSchema } from "../../src/tools/adb-app.js";
import { cacheInputSchema } from "../../src/tools/cache.js";
import { gradleGetDetailsInputSchema } from "../../src/tools/gradle-get-details.js";

// End-to-end guard: the Claude Code MCP client transmits non-string args as strings.
// Every tool schema must now accept stringified values without complaint.
describe("tool schemas accept stringified MCP args (THE-95 guard)", () => {
  it("ui-action: numeric coords and deviceSpace", () => {
    const out = uiActionInputSchema.parse({
      operation: "tap",
      x: "540",
      y: "1200",
      deviceSpace: "true",
    });
    expect(out).toEqual({
      operation: "tap",
      x: 540,
      y: 1200,
      deviceSpace: true,
    });
  });

  it("ui-query: selector as JSON string + numeric bounds + boolean debug", () => {
    const out = uiQueryInputSchema.parse({
      operation: "find",
      selector: '{"textContains":"Connect"}',
      maxTier: "3",
      debug: "false",
      limit: "50",
    });
    expect(out.selector).toEqual({ textContains: "Connect" });
    expect(out.maxTier).toBe(3);
    expect(out.debug).toBe(false);
    expect(out.limit).toBe(50);
  });

  it("ui-query: selector passed as native object also works", () => {
    const out = uiQueryInputSchema.parse({
      operation: "find",
      selector: { resourceId: "login_button" },
    });
    expect(out.selector).toEqual({ resourceId: "login_button" });
  });

  it("ui-capture: booleans + numeric", () => {
    expect(
      uiCaptureInputSchema.parse({
        operation: "screenshot",
        inline: "true",
        raw: "false",
        maxDimension: "1024",
      }),
    ).toEqual({
      operation: "screenshot",
      inline: true,
      raw: false,
      maxDimension: 1024,
    });
  });

  it("adb-shell: timeout + summaryOnly", () => {
    const out = adbShellInputSchema.parse({
      command: "ls",
      timeout: "5000",
      summaryOnly: "true",
      maxChars: "200",
    });
    expect(out.timeout).toBe(5000);
    expect(out.summaryOnly).toBe(true);
    expect(out.maxChars).toBe(200);
  });

  it("adb-logcat: lines as string", () => {
    expect(adbLogcatInputSchema.parse({ lines: "50" }).lines).toBe(50);
  });

  it("adb-app: limit/offset as strings", () => {
    const out = adbAppInputSchema.parse({
      operation: "list",
      limit: "20",
      offset: "40",
    });
    expect(out.limit).toBe(20);
    expect(out.offset).toBe(40);
  });

  it("cache: nested config object as JSON string", () => {
    const out = cacheInputSchema.parse({
      operation: "set-config",
      config: '{"maxEntries":"100","defaultTtlMs":"60000"}',
    });
    expect(out.config).toEqual({ maxEntries: 100, defaultTtlMs: 60000 });
  });

  it("gradle-get-details: numeric bounds + boolean", () => {
    const out = gradleGetDetailsInputSchema.parse({
      id: "test-42",
      maxChars: "5000",
      summaryOnly: "true",
      previewChars: "200",
    });
    expect(out.maxChars).toBe(5000);
    expect(out.summaryOnly).toBe(true);
    expect(out.previewChars).toBe(200);
  });

  it("unknown fields are rejected across all tools (strict schemas — THE-97)", () => {
    expect(() =>
      uiActionInputSchema.parse({ operation: "tap", x: 1, y: 2, surprise: "!" }),
    ).toThrow();
    expect(() =>
      adbLogcatInputSchema.parse({ lines: 5, madeUpField: "oops" }),
    ).toThrow();
  });
});
