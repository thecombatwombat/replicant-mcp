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

describe("Output Summary Mode", () => {
  let context: ServerContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it("returns compact adb-shell payload when summaryOnly=true", async () => {
    vi.mocked(context.adb.shell).mockResolvedValue({
      stdout: "line\n".repeat(120),
      stderr: "",
      exitCode: 0,
    });

    const result = await handleAdbShellTool(
      { command: "dumpsys activity", summaryOnly: true },
      context,
    );

    expect(result.summarized).toBe(true);
    expect((result as Record<string, unknown>).stdout).toBeUndefined();
    expect((result as Record<string, unknown>).stderr).toBeUndefined();
    expect(result.stdoutPreview).toBeDefined();
    expect((result.stdoutPreview as string).length).toBeLessThanOrEqual(200);
    expect(result.originalStdoutChars).toBeGreaterThan(200);
  });

  it("uses custom adb-shell previewChars when provided", async () => {
    vi.mocked(context.adb.shell).mockResolvedValue({
      stdout: "x".repeat(300),
      stderr: "y".repeat(300),
      exitCode: 0,
    });

    const result = await handleAdbShellTool(
      { command: "dumpsys activity", summaryOnly: true, previewChars: 50 },
      context,
    );

    expect((result.stdoutPreview as string).length).toBe(50);
    expect((result.stderrPreview as string).length).toBe(50);
  });

  it("returns compact gradle-get-details logs payload when summaryOnly=true", async () => {
    vi.mocked(context.cache.get).mockReturnValue({
      data: {
        fullOutput: "w: warning\n".repeat(30) + "e: error\n".repeat(20),
        result: { success: false },
        operation: "assembleDebug",
      },
    });

    const result = await handleGradleGetDetailsTool(
      { id: "build-1", detailType: "logs", summaryOnly: true },
      context,
    );

    expect(result.summarized).toBe(true);
    expect(result.detailType).toBe("logs");
    expect(result.summary).toMatchObject({
      lineCount: expect.any(Number),
      warnCount: expect.any(Number),
      errorCount: expect.any(Number),
      charCount: expect.any(Number),
    });
    expect((result.preview as string).length).toBeLessThanOrEqual(400);
    expect((result as Record<string, unknown>).logs).toBeUndefined();
  });

  it("uses custom gradle-get-details previewChars when provided", async () => {
    vi.mocked(context.cache.get).mockReturnValue({
      data: {
        fullOutput: "z".repeat(600),
        result: { success: false },
        operation: "assembleDebug",
      },
    });

    const result = await handleGradleGetDetailsTool(
      { id: "build-1", detailType: "logs", summaryOnly: true, previewChars: 120 },
      context,
    );

    expect(result.detailType).toBe("logs");
    expect((result.preview as string).length).toBe(120);
  });

  it("does not treat standalone W/E characters as warnings or errors", async () => {
    vi.mocked(context.cache.get).mockReturnValue({
      data: {
        fullOutput: [
          "Path /tmp/W/cache",
          "Hex value 0xE0",
          "normal output",
        ].join("\n"),
        result: { success: true },
        operation: "assembleDebug",
      },
    });

    const result = await handleGradleGetDetailsTool(
      { id: "build-1", detailType: "logs", summaryOnly: true },
      context,
    );

    expect(result.detailType).toBe("logs");
    expect(result.summary).toMatchObject({ warnCount: 0, errorCount: 0 });
  });
});
