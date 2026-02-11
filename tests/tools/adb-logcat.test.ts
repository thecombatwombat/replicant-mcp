import { describe, it, expect, vi } from "vitest";
import { handleAdbLogcatTool, AdbLogcatInput } from "../../src/tools/adb-logcat.js";
import { ServerContext } from "../../src/server.js";
import { CacheManager, DeviceStateManager } from "../../src/services/index.js";

function createMockContext(logOutput: string = ""): ServerContext {
  const cache = new CacheManager();
  const deviceState = new DeviceStateManager();
  deviceState.setCurrentDevice({ id: "emulator-5554", status: "device" });

  return {
    cache,
    deviceState,
    adb: {
      logcat: vi.fn().mockResolvedValue(logOutput),
    },
  } as unknown as ServerContext;
}

describe("adb-logcat", () => {
  describe("package filtering", () => {
    it("passes package parameter to adapter", async () => {
      const context = createMockContext("");
      await handleAdbLogcatTool(
        { lines: 100, package: "com.example.app" } as AdbLogcatInput,
        context
      );

      expect(context.adb.logcat).toHaveBeenCalledWith(
        "emulator-5554",
        expect.objectContaining({ package: "com.example.app" })
      );
    });

    it("passes since parameter to adapter", async () => {
      const context = createMockContext("");
      await handleAdbLogcatTool(
        { lines: 100, since: "01-20 15:30:00.000" } as AdbLogcatInput,
        context
      );

      expect(context.adb.logcat).toHaveBeenCalledWith(
        "emulator-5554",
        expect.objectContaining({ since: "01-20 15:30:00.000" })
      );
    });

    it("passes both package and since together", async () => {
      const context = createMockContext("");
      await handleAdbLogcatTool(
        { lines: 50, package: "com.example", since: "01-20 15:30:00.000" } as AdbLogcatInput,
        context
      );

      expect(context.adb.logcat).toHaveBeenCalledWith(
        "emulator-5554",
        expect.objectContaining({
          package: "com.example",
          since: "01-20 15:30:00.000",
        })
      );
    });

    it("does not pass package or since when not provided", async () => {
      const context = createMockContext("");
      await handleAdbLogcatTool(
        { lines: 100 } as AdbLogcatInput,
        context
      );

      expect(context.adb.logcat).toHaveBeenCalledWith(
        "emulator-5554",
        expect.objectContaining({
          lines: 100,
          package: undefined,
          since: undefined,
        })
      );
    });
  });
});
