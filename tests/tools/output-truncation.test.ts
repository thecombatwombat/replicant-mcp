import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAdbShellTool } from "../../src/tools/adb-shell.js";
import { handleGradleGetDetailsTool } from "../../src/tools/gradle-get-details.js";
import { ServerContext } from "../../src/server.js";

function createMockContext(): ServerContext {
  return {
    deviceState: {
      ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
    },
    adb: {
      shell: vi.fn(),
    },
    cache: {
      get: vi.fn(),
    },
  } as unknown as ServerContext;
}

describe("Output Truncation", () => {
  let context: ServerContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it("truncates adb-shell stdout when maxChars is provided", async () => {
    vi.mocked(context.adb.shell).mockResolvedValue({
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

  it("omits original char counts when maxChars is not requested", async () => {
    vi.mocked(context.adb.shell).mockResolvedValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    });

    const result = await handleAdbShellTool(
      { command: "echo test" },
      context,
    );

    expect(result.truncated).toBe(false);
    expect((result as Record<string, unknown>).originalStdoutChars).toBeUndefined();
    expect((result as Record<string, unknown>).originalStderrChars).toBeUndefined();
  });

  it("truncates gradle-get-details logs when maxChars is provided", async () => {
    vi.mocked(context.cache.get).mockReturnValue({
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
