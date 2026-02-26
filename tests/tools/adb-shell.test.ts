import { describe, it, expect, vi } from "vitest";
import { handleAdbShellTool, AdbShellInput } from "../../src/tools/adb-shell.js";
import { ServerContext } from "../../src/server.js";
import { DeviceStateManager } from "../../src/services/index.js";

function createMockContext(): ServerContext {
  const deviceState = new DeviceStateManager();
  deviceState.setCurrentDevice({ id: "emulator-5554", status: "device" });

  return {
    deviceState,
    adb: {
      shell: vi.fn().mockResolvedValue({
        stdout: "ok",
        stderr: "",
        exitCode: 0,
      }),
    },
  } as unknown as ServerContext;
}

describe("adb-shell", () => {
  describe("timeout cap", () => {
    it("caps timeout at 120s even if higher value is provided", async () => {
      const context = createMockContext();
      await handleAdbShellTool(
        { command: "ls", timeout: 300_000 } as AdbShellInput,
        context
      );

      expect(context.adb.shell).toHaveBeenCalledWith(
        "emulator-5554",
        "ls",
        120_000
      );
    });

    it("passes through timeout values under 120s unchanged", async () => {
      const context = createMockContext();
      await handleAdbShellTool(
        { command: "ls", timeout: 60_000 } as AdbShellInput,
        context
      );

      expect(context.adb.shell).toHaveBeenCalledWith(
        "emulator-5554",
        "ls",
        60_000
      );
    });

    it("passes undefined timeout when not specified", async () => {
      const context = createMockContext();
      await handleAdbShellTool(
        { command: "ls" } as AdbShellInput,
        context
      );

      expect(context.adb.shell).toHaveBeenCalledWith(
        "emulator-5554",
        "ls",
        undefined
      );
    });
  });
});
