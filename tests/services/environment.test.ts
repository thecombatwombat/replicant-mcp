import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EnvironmentService } from "../../src/services/environment.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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
      const sdkPath = path.join("/opt", "android-sdk");
      const adbPath = path.join(sdkPath, "platform-tools", "adb");
      process.env.ANDROID_HOME = sdkPath;
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === adbPath;
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe(sdkPath);
      expect(env.adbPath).toBe(adbPath);
      expect(env.isValid).toBe(true);
    });

    it("uses ANDROID_SDK_ROOT as fallback", async () => {
      const sdkPath = path.join("/usr", "local", "android");
      const adbPath = path.join(sdkPath, "platform-tools", "adb");
      process.env.ANDROID_SDK_ROOT = sdkPath;
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === adbPath;
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe(sdkPath);
      expect(env.isValid).toBe(true);
    });

    it("probes common macOS paths when env vars not set", async () => {
      const homedir = path.join("/Users", "test");
      const sdkPath = path.join(homedir, "Library", "Android", "sdk");
      const adbPath = path.join(sdkPath, "platform-tools", "adb");
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue(homedir);
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === adbPath;
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe(sdkPath);
      expect(env.isValid).toBe(true);
    });

    it("probes common Linux paths when env vars not set", async () => {
      const homedir = path.join("/home", "test");
      const sdkPath = path.join(homedir, "Android", "Sdk");
      const adbPath = path.join(sdkPath, "platform-tools", "adb");
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(os.homedir).mockReturnValue(homedir);
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === adbPath;
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe(sdkPath);
      expect(env.isValid).toBe(true);
    });

    it("returns invalid when SDK not found anywhere", async () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue(path.join("/Users", "test"));
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const env = await service.detect();

      expect(env.isValid).toBe(false);
      expect(env.issues.length).toBeGreaterThan(0);
      expect(env.issues[0]).toContain("Android SDK not found");
    });

    it("caches result after first detection", async () => {
      process.env.ANDROID_HOME = path.join("/opt", "android-sdk");
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
      const sdkPath = path.join("/opt", "android-sdk");
      const adbPath = path.join(sdkPath, "platform-tools", "adb");
      process.env.ANDROID_HOME = sdkPath;
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await service.getAdbPath();

      expect(result).toBe(adbPath);
    });

    it("throws when SDK not found", async () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue(path.join("/Users", "test"));
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(service.getAdbPath()).rejects.toThrow("Android SDK not found");
    });
  });

  describe("Windows support", () => {
    beforeEach(() => {
      service = new EnvironmentService();
      (service as any).cached = null;
      delete process.env.ANDROID_HOME;
      delete process.env.ANDROID_SDK_ROOT;
    });

    it("uses .exe extension for adb on Windows", async () => {
      const sdkPath = "C:\\Users\\test\\AppData\\Local\\Android\\Sdk";
      const expectedAdbPath = path.join(sdkPath, "platform-tools", "adb.exe");
      process.env.ANDROID_HOME = sdkPath;
      vi.mocked(os.platform).mockReturnValue("win32");
      vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === expectedAdbPath;
      });

      const env = await service.detect();

      expect(env.adbPath).toBe(expectedAdbPath);
      expect(env.isValid).toBe(true);
    });

    it("uses .exe extension for emulator on Windows", async () => {
      const sdkPath = "C:\\Users\\test\\AppData\\Local\\Android\\Sdk";
      const expectedAdbPath = path.join(sdkPath, "platform-tools", "adb.exe");
      const expectedEmulatorPath = path.join(sdkPath, "emulator", "emulator.exe");
      process.env.ANDROID_HOME = sdkPath;
      vi.mocked(os.platform).mockReturnValue("win32");
      vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const validPaths = [expectedAdbPath, expectedEmulatorPath];
        return validPaths.includes(p as string);
      });

      const env = await service.detect();

      expect(env.emulatorPath).toBe(expectedEmulatorPath);
    });

    it("probes Windows-specific paths when env vars not set", async () => {
      const localAppData = "C:\\Users\\test\\AppData\\Local";
      const expectedSdkPath = path.join(localAppData, "Android", "Sdk");
      const expectedAdbPath = path.join(expectedSdkPath, "platform-tools", "adb.exe");
      vi.mocked(os.platform).mockReturnValue("win32");
      vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
      process.env.LOCALAPPDATA = localAppData;
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === expectedAdbPath;
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe(expectedSdkPath);
      expect(env.isValid).toBe(true);
    });

    it("finds adb in PATH when SDK paths fail (Unix)", async () => {
      const originalPath = process.env.PATH;
      const homedir = path.join("/home", "test");
      const sdkPath = path.join(homedir, "android-sdk");
      const adbDir = path.join(sdkPath, "platform-tools");
      const adbPath = path.join(adbDir, "adb");
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(os.homedir).mockReturnValue(homedir);
      // Use path separator appropriate for the test runner
      process.env.PATH = `/usr/bin:${adbDir}`;
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        // Only adb in PATH exists, not in standard locations
        return p === adbPath;
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe(sdkPath);
      expect(env.isValid).toBe(true);
      process.env.PATH = originalPath;
    });

    it("finds adb in PATH when SDK paths fail (Windows)", async () => {
      const originalPath = process.env.PATH;
      // Use pure Windows paths - the production code uses manual string concat, not path.join
      const sdkPath = "C:\\android-sdk";
      const adbDir = "C:\\android-sdk\\platform-tools";
      vi.mocked(os.platform).mockReturnValue("win32");
      vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
      process.env.PATH = `C:\\Windows\\System32;${adbDir}`;
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pStr = p as string;
        // Normalize path for comparison (handle both \ and / separators)
        // This is needed because path.join uses the host platform's separator
        const normalized = pStr.replace(/\//g, "\\");
        return (
          normalized === "C:\\android-sdk\\platform-tools\\adb.exe" ||
          normalized === "C:\\android-sdk\\emulator\\emulator.exe"
        );
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe(sdkPath);
      expect(env.isValid).toBe(true);
      process.env.PATH = originalPath;
    });

    it("validates derived SDK path has platform-tools", async () => {
      const originalPath = process.env.PATH;
      const homedir = path.join("/home", "test");
      const binDir = path.join("/usr", "local", "bin");
      const adbPath = path.join(binDir, "adb");
      const invalidSdkPlatformTools = path.join("/usr", "local", "platform-tools");
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(os.homedir).mockReturnValue(homedir);
      // adb is in /usr/local/bin (standalone, not in SDK)
      process.env.PATH = binDir;
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        // adb exists but parent doesn't have platform-tools structure
        if (p === adbPath) return true;
        if (p === invalidSdkPlatformTools) return false;
        return false;
      });

      const env = await service.detect();

      // Should NOT use standalone adb as SDK
      expect(env.isValid).toBe(false);
      process.env.PATH = originalPath;
    });

    it("uses .bat extension for avdmanager on Windows", async () => {
      const sdkPath = "C:\\Users\\test\\AppData\\Local\\Android\\Sdk";
      const expectedAdbPath = path.join(sdkPath, "platform-tools", "adb.exe");
      const expectedAvdManagerPath = path.join(sdkPath, "cmdline-tools", "latest", "bin", "avdmanager.bat");
      process.env.ANDROID_HOME = sdkPath;
      vi.mocked(os.platform).mockReturnValue("win32");
      vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const validPaths = [expectedAdbPath, expectedAvdManagerPath];
        return validPaths.includes(p as string);
      });

      const avdManagerPath = await service.getAvdManagerPath();

      expect(avdManagerPath).toBe(expectedAvdManagerPath);
    });
  });
});
