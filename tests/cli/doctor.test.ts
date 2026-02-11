import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);
const mockedExistsSync = vi.mocked(existsSync);

// Import after mocking
import { runChecks, formatJson, type CheckResult } from "../../src/cli/doctor.js";

function setupAllPass(): void {
  Object.defineProperty(process, "version", { value: "v20.10.0", configurable: true });

  process.env.ANDROID_HOME = "/usr/local/android-sdk";
  mockedExistsSync.mockReturnValue(true);

  mockedExecSync.mockImplementation((cmd: string) => {
    const command = String(cmd);
    if (command === "npm --version") return "10.2.0\n";
    if (command === "adb version") return "Android Debug Bridge version 34.0.5\n";
    if (command === "emulator -version") return "Android emulator version 33.1.24\n";
    if (command === "avdmanager list avd") return "Name: Pixel_7_API_34\nName: Pixel_6_API_33\n";
    if (command === "adb devices") return "List of devices attached\nemulator-5554\tdevice\n";
    if (command === "gradle --version") return "Gradle 8.4\n";
    return "";
  });
}

describe("replicant doctor", () => {
  const originalEnv = { ...process.env };
  const originalVersion = process.version;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process, "version", { value: originalVersion, configurable: true });
  });

  describe("all-pass scenario", () => {
    it("returns ok for all 9 checks when environment is fully configured", () => {
      setupAllPass();
      const checks = runChecks();

      expect(checks).toHaveLength(9);
      for (const check of checks) {
        expect(check.status).toBe("ok");
      }
    });

    it("detects Node.js version correctly", () => {
      setupAllPass();
      const checks = runChecks();
      const node = checks.find((c) => c.name === "Node.js")!;
      expect(node.status).toBe("ok");
      expect(node.detail).toBe("v20.10.0");
    });

    it("detects npm version", () => {
      setupAllPass();
      const checks = runChecks();
      const npm = checks.find((c) => c.name === "npm")!;
      expect(npm.status).toBe("ok");
      expect(npm.detail).toBe("10.2.0");
    });

    it("detects adb version", () => {
      setupAllPass();
      const checks = runChecks();
      const adb = checks.find((c) => c.name === "adb")!;
      expect(adb.status).toBe("ok");
      expect(adb.detail).toBe("34.0.5");
    });

    it("counts AVDs correctly", () => {
      setupAllPass();
      const checks = runChecks();
      const avds = checks.find((c) => c.name === "AVDs")!;
      expect(avds.status).toBe("ok");
      expect(avds.detail).toBe("2 available");
    });

    it("counts connected devices", () => {
      setupAllPass();
      const checks = runChecks();
      const devices = checks.find((c) => c.name === "Connected devices")!;
      expect(devices.status).toBe("ok");
      expect(devices.detail).toBe("1 connected");
    });
  });

  describe("failure scenario", () => {
    it("reports fail when adb is not found", () => {
      setupAllPass();
      mockedExecSync.mockImplementation((cmd: string) => {
        if (String(cmd) === "adb version") throw new Error("not found");
        if (String(cmd) === "adb devices") throw new Error("not found");
        if (String(cmd) === "npm --version") return "10.2.0\n";
        if (String(cmd) === "emulator -version") return "Android emulator version 33.1.24\n";
        if (String(cmd) === "avdmanager list avd") return "Name: Pixel_7\n";
        if (String(cmd) === "gradle --version") return "Gradle 8.4\n";
        return "";
      });

      const checks = runChecks();
      const adb = checks.find((c) => c.name === "adb")!;
      expect(adb.status).toBe("fail");
      expect(adb.detail).toBe("not found");
      expect(adb.suggestion).toBeDefined();

      // Devices should also fail when adb is unavailable
      const devices = checks.find((c) => c.name === "Connected devices")!;
      expect(devices.status).toBe("fail");
      expect(devices.detail).toContain("skipped");
    });

    it("reports fail when ANDROID_HOME is not set", () => {
      setupAllPass();
      delete process.env.ANDROID_HOME;

      const checks = runChecks();
      const home = checks.find((c) => c.name === "ANDROID_HOME")!;
      expect(home.status).toBe("fail");
      expect(home.detail).toBe("not set");
    });

    it("reports fail when ANDROID_HOME path does not exist", () => {
      setupAllPass();
      process.env.ANDROID_HOME = "/nonexistent/path";
      mockedExistsSync.mockReturnValue(false);

      const checks = runChecks();
      const home = checks.find((c) => c.name === "ANDROID_HOME")!;
      expect(home.status).toBe("fail");
      expect(home.detail).toContain("not found");
    });
  });

  describe("warning scenario", () => {
    it("warns when no AVDs are available", () => {
      setupAllPass();
      mockedExecSync.mockImplementation((cmd: string) => {
        if (String(cmd) === "avdmanager list avd") return "Available Android Virtual Devices:\n";
        if (String(cmd) === "npm --version") return "10.2.0\n";
        if (String(cmd) === "adb version") return "Android Debug Bridge version 34.0.5\n";
        if (String(cmd) === "emulator -version") return "Android emulator version 33.1.24\n";
        if (String(cmd) === "adb devices") return "List of devices attached\n";
        if (String(cmd) === "gradle --version") throw new Error("not found");
        return "";
      });

      const checks = runChecks();
      const avds = checks.find((c) => c.name === "AVDs")!;
      expect(avds.status).toBe("warn");
      expect(avds.detail).toBe("none found");
    });

    it("warns when gradle is not installed (optional)", () => {
      setupAllPass();
      mockedExecSync.mockImplementation((cmd: string) => {
        if (String(cmd) === "gradle --version") throw new Error("not found");
        if (String(cmd) === "npm --version") return "10.2.0\n";
        if (String(cmd) === "adb version") return "Android Debug Bridge version 34.0.5\n";
        if (String(cmd) === "emulator -version") return "Android emulator version 33.1.24\n";
        if (String(cmd) === "avdmanager list avd") return "Name: Pixel_7\n";
        if (String(cmd) === "adb devices") return "List of devices attached\nemulator-5554\tdevice\n";
        return "";
      });

      const checks = runChecks();
      const gradle = checks.find((c) => c.name === "System gradle")!;
      expect(gradle.status).toBe("warn");
      expect(gradle.detail).toContain("optional");
    });

    it("warns when no devices are connected", () => {
      setupAllPass();
      mockedExecSync.mockImplementation((cmd: string) => {
        if (String(cmd) === "adb devices") return "List of devices attached\n\n";
        if (String(cmd) === "npm --version") return "10.2.0\n";
        if (String(cmd) === "adb version") return "Android Debug Bridge version 34.0.5\n";
        if (String(cmd) === "emulator -version") return "Android emulator version 33.1.24\n";
        if (String(cmd) === "avdmanager list avd") return "Name: Pixel_7\n";
        if (String(cmd) === "gradle --version") return "Gradle 8.4\n";
        return "";
      });

      const checks = runChecks();
      const devices = checks.find((c) => c.name === "Connected devices")!;
      expect(devices.status).toBe("warn");
      expect(devices.detail).toBe("0 connected");
    });
  });

  describe("JSON output", () => {
    it("produces valid JSON with status, checks, and summary", () => {
      setupAllPass();
      const checks = runChecks();
      const json = formatJson(checks);
      const parsed = JSON.parse(json);

      expect(parsed.status).toBe("ok");
      expect(parsed.checks).toHaveLength(9);
      expect(parsed.summary).toEqual({ ok: 9, warn: 0, fail: 0 });
    });

    it("reports overall fail status when any check fails", () => {
      setupAllPass();
      delete process.env.ANDROID_HOME;

      const checks = runChecks();
      const json = formatJson(checks);
      const parsed = JSON.parse(json);

      expect(parsed.status).toBe("fail");
      expect(parsed.summary.fail).toBeGreaterThan(0);
    });

    it("reports overall warn status when no fails but warnings exist", () => {
      setupAllPass();
      mockedExecSync.mockImplementation((cmd: string) => {
        if (String(cmd) === "gradle --version") throw new Error("not found");
        if (String(cmd) === "npm --version") return "10.2.0\n";
        if (String(cmd) === "adb version") return "Android Debug Bridge version 34.0.5\n";
        if (String(cmd) === "emulator -version") return "Android emulator version 33.1.24\n";
        if (String(cmd) === "avdmanager list avd") return "Name: Pixel_7\n";
        if (String(cmd) === "adb devices") return "List of devices attached\nemulator-5554\tdevice\n";
        return "";
      });

      const checks = runChecks();
      const json = formatJson(checks);
      const parsed = JSON.parse(json);

      expect(parsed.status).toBe("warn");
      expect(parsed.summary.fail).toBe(0);
      expect(parsed.summary.warn).toBeGreaterThan(0);
    });

    it("includes suggestion field only for non-ok checks", () => {
      setupAllPass();
      delete process.env.ANDROID_HOME;

      const checks = runChecks();
      const okChecks = checks.filter((c) => c.status === "ok");
      const failChecks = checks.filter((c) => c.status === "fail");

      // ok checks should not have suggestions
      for (const c of okChecks) {
        expect(c.suggestion).toBeUndefined();
      }
      // fail checks should have suggestions
      for (const c of failChecks) {
        expect(c.suggestion).toBeDefined();
      }
    });
  });

  describe("exit code", () => {
    it("should not exit when all checks pass or warn", () => {
      setupAllPass();
      const checks = runChecks();
      const hasFail = checks.some((c) => c.status === "fail");
      expect(hasFail).toBe(false);
    });

    it("should indicate failure when any check fails", () => {
      setupAllPass();
      delete process.env.ANDROID_HOME;

      const checks = runChecks();
      const hasFail = checks.some((c) => c.status === "fail");
      expect(hasFail).toBe(true);
    });
  });
});
