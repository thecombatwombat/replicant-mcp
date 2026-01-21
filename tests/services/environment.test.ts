import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EnvironmentService } from "../../src/services/environment.js";
import * as fs from "fs";
import * as os from "os";

// Mock fs and os
vi.mock("fs");
vi.mock("os");

describe("EnvironmentService", () => {
  let service: EnvironmentService;

  beforeEach(() => {
    service = new EnvironmentService();
    vi.resetAllMocks();
    // Clear cached environment
    (service as any).cached = null;
  });

  afterEach(() => {
    // Restore env vars
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
  });

  describe("detect", () => {
    it("uses ANDROID_HOME when set and valid", async () => {
      process.env.ANDROID_HOME = "/opt/android-sdk";
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/opt/android-sdk/platform-tools/adb";
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe("/opt/android-sdk");
      expect(env.adbPath).toBe("/opt/android-sdk/platform-tools/adb");
      expect(env.isValid).toBe(true);
    });

    it("uses ANDROID_SDK_ROOT as fallback", async () => {
      process.env.ANDROID_SDK_ROOT = "/usr/local/android";
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/usr/local/android/platform-tools/adb";
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe("/usr/local/android");
      expect(env.isValid).toBe(true);
    });

    it("probes common macOS paths when env vars not set", async () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue("/Users/test");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/Users/test/Library/Android/sdk/platform-tools/adb";
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe("/Users/test/Library/Android/sdk");
      expect(env.isValid).toBe(true);
    });

    it("probes common Linux paths when env vars not set", async () => {
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(os.homedir).mockReturnValue("/home/test");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/home/test/Android/Sdk/platform-tools/adb";
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe("/home/test/Android/Sdk");
      expect(env.isValid).toBe(true);
    });

    it("returns invalid when SDK not found anywhere", async () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue("/Users/test");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const env = await service.detect();

      expect(env.isValid).toBe(false);
      expect(env.issues.length).toBeGreaterThan(0);
      expect(env.issues[0]).toContain("Android SDK not found");
    });

    it("caches result after first detection", async () => {
      process.env.ANDROID_HOME = "/opt/android-sdk";
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const firstResult = await service.detect();
      const callsAfterFirst = vi.mocked(fs.existsSync).mock.calls.length;

      const secondResult = await service.detect();
      const callsAfterSecond = vi.mocked(fs.existsSync).mock.calls.length;

      // No additional existsSync calls on second detect (caching works)
      expect(callsAfterSecond).toBe(callsAfterFirst);
      // Returns exact same object reference (true caching)
      expect(secondResult).toBe(firstResult);
    });
  });

  describe("getAdbPath", () => {
    it("returns adb path when valid", async () => {
      process.env.ANDROID_HOME = "/opt/android-sdk";
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const adbPath = await service.getAdbPath();

      expect(adbPath).toBe("/opt/android-sdk/platform-tools/adb");
    });

    it("throws when SDK not found", async () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue("/Users/test");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(service.getAdbPath()).rejects.toThrow("Android SDK not found");
    });
  });
});
