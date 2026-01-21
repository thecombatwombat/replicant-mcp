import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeviceStateManager } from "../../src/services/device-state.js";
import { EnvironmentService } from "../../src/services/environment.js";

describe("Just Works UX Integration", () => {
  describe("Auto device selection flow", () => {
    it("auto-selects single device without explicit list call", async () => {
      const manager = new DeviceStateManager();
      const mockAdb = {
        getDevices: vi.fn().mockResolvedValue([
          { id: "emulator-5554", type: "emulator", name: "test", status: "online" }
        ]),
      };

      // Simulating what ui dump would do
      const device = await manager.ensureDevice(mockAdb as any);

      expect(device.id).toBe("emulator-5554");
      expect(mockAdb.getDevices).toHaveBeenCalledTimes(1);

      // Second call should not re-query (device already selected)
      const device2 = await manager.ensureDevice(mockAdb as any);
      expect(device2.id).toBe("emulator-5554");
      expect(mockAdb.getDevices).toHaveBeenCalledTimes(1);
    });

    it("throws helpful error with no devices", async () => {
      const manager = new DeviceStateManager();
      const mockAdb = {
        getDevices: vi.fn().mockResolvedValue([]),
      };

      await expect(manager.ensureDevice(mockAdb as any)).rejects.toMatchObject({
        code: "NO_DEVICES",
        suggestion: expect.stringContaining("emulator"),
      });
    });

    it("throws helpful error with multiple devices", async () => {
      const manager = new DeviceStateManager();
      const mockAdb = {
        getDevices: vi.fn().mockResolvedValue([
          { id: "emulator-5554", type: "emulator", name: "test1", status: "online" },
          { id: "device-1234", type: "physical", name: "test2", status: "online" },
        ]),
      };

      try {
        await manager.ensureDevice(mockAdb as any);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.code).toBe("MULTIPLE_DEVICES");
        expect(error.message).toContain("emulator-5554");
        expect(error.message).toContain("device-1234");
      }
    });
  });

  describe("Environment detection flow", () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.ANDROID_HOME;
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.ANDROID_HOME = originalEnv;
      } else {
        delete process.env.ANDROID_HOME;
      }
    });

    it("caches detection results", async () => {
      const env = new EnvironmentService();
      // Force a specific result by setting env var
      process.env.ANDROID_HOME = "/fake/path";

      const result1 = await env.detect();
      const result2 = await env.detect();

      // Should return same cached object
      expect(result1).toBe(result2);
    });

    it("detection returns expected structure", async () => {
      const env = new EnvironmentService();

      const result = await env.detect();

      // Regardless of whether SDK is found, structure should be present
      expect(result).toHaveProperty("sdkPath");
      expect(result).toHaveProperty("adbPath");
      expect(result).toHaveProperty("platform");
      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("issues");
      expect(["darwin", "linux", "win32"]).toContain(result.platform);
    });
  });

  describe("Error message quality", () => {
    it("NO_DEVICES error has actionable suggestion", async () => {
      const manager = new DeviceStateManager();
      const mockAdb = {
        getDevices: vi.fn().mockResolvedValue([]),
      };

      try {
        await manager.ensureDevice(mockAdb as any);
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.suggestion).toBeTruthy();
        expect(error.suggestion.length).toBeGreaterThan(20);
        // Should mention how to fix
        expect(
          error.suggestion.toLowerCase().includes("emulator") ||
          error.suggestion.toLowerCase().includes("device")
        ).toBe(true);
      }
    });

    it("MULTIPLE_DEVICES error lists available devices", async () => {
      const manager = new DeviceStateManager();
      const mockAdb = {
        getDevices: vi.fn().mockResolvedValue([
          { id: "emulator-5554", type: "emulator", name: "test1", status: "online" },
          { id: "pixel-abc123", type: "physical", name: "test2", status: "online" },
        ]),
      };

      try {
        await manager.ensureDevice(mockAdb as any);
        expect.fail("Should have thrown");
      } catch (error: any) {
        // Error message should include device IDs so user knows what to choose
        expect(error.message).toContain("emulator-5554");
        expect(error.message).toContain("pixel-abc123");
        // Suggestion should explain how to select
        expect(error.suggestion).toContain("select");
      }
    });
  });
});
