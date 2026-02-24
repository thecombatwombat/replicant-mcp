import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAdbShellTool } from "../../src/tools/adb-shell.js";
import { handleGradleGetDetailsTool } from "../../src/tools/gradle-get-details.js";

describe("Output Truncation", () => {
  let context: any;

  beforeEach(() => {
    context = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      adb: {
        shell: vi.fn(),
      },
      cache: {
        get: vi.fn(),
      },
    };
  });

  it("truncates adb-shell stdout when maxChars is provided", async () => {
    context.adb.shell.mockResolvedValue({
      stdout: "x".repeat(200),
      stderr: "",
      exitCode: 0,
    });

    const result = await handleAdbShellTool(
      { command: "echo test", maxChars: 50 },
      context,
    );

    expect(result.stdout).toHaveLength(50);
    expect(result.truncated).toBe(true);
    expect(result.originalStdoutChars).toBe(200);
  });

  it("truncates gradle-get-details logs when maxChars is provided", async () => {
    context.cache.get.mockReturnValue({
      data: {
        fullOutput: "line\n".repeat(100),
        result: { success: true },
        operation: "assembleDebug",
      },
    });

    const result = await handleGradleGetDetailsTool(
      { id: "build-1", detailType: "logs", maxChars: 80 },
      context,
    );

    expect(result.detailType).toBe("logs");
    expect(result.logs).toHaveLength(80);
    expect(result.truncated).toBe(true);
    expect(result.originalChars).toBeGreaterThan(80);
  });
});
