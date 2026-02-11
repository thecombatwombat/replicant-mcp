/**
 * Error Standardization Tests
 *
 * Verifies that all tool handlers throw ReplicantError with correct ErrorCodes
 * instead of generic Error for validation failures and unknown operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReplicantError, ErrorCode } from "../../src/types/index.js";
import { createServerContext, ServerContext } from "../../src/server.js";
import { handleEmulatorDeviceTool } from "../../src/tools/emulator-device.js";
import { handleAdbAppTool } from "../../src/tools/adb-app.js";
import { handleAdbDeviceTool } from "../../src/tools/adb-device.js";
import { handleUiTool } from "../../src/tools/ui.js";
import { handleCacheTool } from "../../src/tools/cache.js";
import { handleGradleListTool } from "../../src/tools/gradle-list.js";
import { CacheManager } from "../../src/services/index.js";

// Mock execa to control CLI output
vi.mock("execa", async () => {
  const actual = await vi.importActual("execa");
  return {
    ...actual,
    execa: vi.fn(),
  };
});

// Mock fs for environment detection
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: vi.fn((path: string) => {
      if (
        path.includes("platform-tools/adb") ||
        path.includes("emulator/emulator") ||
        path.includes("cmdline-tools") ||
        path.includes("tools/bin/avdmanager")
      ) {
        return true;
      }
      return false;
    }),
  };
});

import { execa } from "execa";
const mockedExeca = vi.mocked(execa);

function expectReplicantError(error: unknown, expectedCode: string): void {
  expect(error).toBeInstanceOf(ReplicantError);
  const re = error as ReplicantError;
  expect(re.code).toBe(expectedCode);
  expect(re.suggestion).toBeDefined();
}

describe("Error Standardization", () => {
  let context: ServerContext;
  const originalAndroidHome = process.env.ANDROID_HOME;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANDROID_HOME = "/fake/android/sdk";
    context = createServerContext();
  });

  afterEach(() => {
    if (originalAndroidHome) {
      process.env.ANDROID_HOME = originalAndroidHome;
    } else {
      delete process.env.ANDROID_HOME;
    }
  });

  describe("emulator-device", () => {
    it("throws INPUT_VALIDATION_FAILED for missing params on create", async () => {
      try {
        await handleEmulatorDeviceTool({ operation: "create" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing avdName on start", async () => {
      try {
        await handleEmulatorDeviceTool({ operation: "start" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing emulatorId on kill", async () => {
      try {
        await handleEmulatorDeviceTool({ operation: "kill" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing avdName on wipe", async () => {
      try {
        await handleEmulatorDeviceTool({ operation: "wipe" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing snapshotName on snapshot-save", async () => {
      // Need emulatorId to pass resolveEmulatorId
      context.deviceState.setCurrentDevice({ id: "emulator-5554", type: "emulator", status: "online" });
      try {
        await handleEmulatorDeviceTool({ operation: "snapshot-save" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing snapshotName on snapshot-load", async () => {
      context.deviceState.setCurrentDevice({ id: "emulator-5554", type: "emulator", status: "online" });
      try {
        await handleEmulatorDeviceTool({ operation: "snapshot-load" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing snapshotName on snapshot-delete", async () => {
      context.deviceState.setCurrentDevice({ id: "emulator-5554", type: "emulator", status: "online" });
      try {
        await handleEmulatorDeviceTool({ operation: "snapshot-delete" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing emulatorId on snapshot operations", async () => {
      // No device selected, no emulatorId provided
      try {
        await handleEmulatorDeviceTool({ operation: "snapshot-save", snapshotName: "test" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });
  });

  describe("adb-app", () => {
    // Pre-set device to bypass ensureDevice's adb path resolution (fails on Windows)
    beforeEach(() => {
      context.deviceState.setCurrentDevice({ id: "emulator-5554", type: "emulator", status: "online" });
    });

    it("throws INPUT_VALIDATION_FAILED for missing apkPath on install", async () => {
      try {
        await handleAdbAppTool({ operation: "install" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing packageName on uninstall", async () => {
      try {
        await handleAdbAppTool({ operation: "uninstall" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing packageName on launch", async () => {
      try {
        await handleAdbAppTool({ operation: "launch" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing packageName on stop", async () => {
      try {
        await handleAdbAppTool({ operation: "stop" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing packageName on clear-data", async () => {
      try {
        await handleAdbAppTool({ operation: "clear-data" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });
  });

  describe("adb-device", () => {
    it("throws INPUT_VALIDATION_FAILED for missing deviceId on select", async () => {
      try {
        await handleAdbDeviceTool({ operation: "select" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws DEVICE_NOT_FOUND for non-existent device on select", async () => {
      // Mock adb devices to return a known device list (select calls getDevices directly)
      mockedExeca.mockResolvedValueOnce({
        stdout: "List of devices attached\nemulator-5554\tdevice\n",
        stderr: "",
        exitCode: 0,
      } as any);

      try {
        await handleAdbDeviceTool({ operation: "select", deviceId: "nonexistent-device" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.DEVICE_NOT_FOUND);
      }
    });
  });

  describe("ui", () => {
    // Pre-set device to bypass ensureDevice's adb path resolution (fails on Windows)
    beforeEach(() => {
      context.deviceState.setCurrentDevice({ id: "emulator-5554", type: "emulator", status: "online" });
    });

    it("throws INPUT_VALIDATION_FAILED for missing text on input", async () => {
      try {
        await handleUiTool({ operation: "input" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing direction on scroll", async () => {
      try {
        await handleUiTool({ operation: "scroll" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws INPUT_VALIDATION_FAILED for missing coordinates and elementIndex on tap", async () => {
      try {
        await handleUiTool({ operation: "tap" }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.INPUT_VALIDATION_FAILED);
      }
    });

    it("throws ELEMENT_NOT_FOUND for invalid elementIndex on tap", async () => {
      try {
        await handleUiTool({ operation: "tap", elementIndex: 99 }, context);
        expect.fail("should have thrown");
      } catch (e) {
        expectReplicantError(e, ErrorCode.ELEMENT_NOT_FOUND);
      }
    });
  });

  describe("cache", () => {
    it("handles all valid operations without error", async () => {
      const cache = new CacheManager();
      // These should not throw
      await handleCacheTool({ operation: "get-stats" }, cache);
      await handleCacheTool({ operation: "get-config" }, cache);
      await handleCacheTool({ operation: "clear" }, cache);
    });
  });

  describe("all errors are ReplicantError instances", () => {
    it("ReplicantError extends Error", () => {
      const err = new ReplicantError(ErrorCode.INPUT_VALIDATION_FAILED, "test", "suggestion");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ReplicantError);
      expect(err.name).toBe("ReplicantError");
      expect(err.code).toBe(ErrorCode.INPUT_VALIDATION_FAILED);
      expect(err.suggestion).toBe("suggestion");
    });

    it("new error codes exist", () => {
      expect(ErrorCode.INPUT_VALIDATION_FAILED).toBe("INPUT_VALIDATION_FAILED");
      expect(ErrorCode.INVALID_OPERATION).toBe("INVALID_OPERATION");
      expect(ErrorCode.ELEMENT_NOT_FOUND).toBe("ELEMENT_NOT_FOUND");
    });
  });
});
