import { describe, it, expect } from "vitest";
import {
  formatBuildSuccess,
  formatBuildFailure,
  formatTestResults,
  formatUiDump,
  formatLogcat,
  formatDeviceList,
} from "../../src/cli/formatter.js";

describe("CLI Formatter", () => {
  describe("formatBuildSuccess", () => {
    it("formats successful build with APK path", () => {
      const result = formatBuildSuccess({
        duration: "34s",
        apkPath: "app/build/outputs/apk/debug/app-debug.apk",
        apkSize: "12.4 MB",
        warnings: 2,
        cacheId: "build-a1b2c3",
      });

      expect(result).toContain("✓ Build successful");
      expect(result).toContain("34s");
      expect(result).toContain("app-debug.apk");
      expect(result).toContain("12.4 MB");
      expect(result).toContain("Warnings: 2");
      expect(result).toContain("build-a1b2c3");
    });
  });

  describe("formatBuildFailure", () => {
    it("formats failed build with error and cache id", () => {
      const result = formatBuildFailure({
        duration: "12s",
        error: "Unresolved reference: userRepository",
        cacheId: "build-x1y2z3",
      });

      expect(result).toContain("✗ Build failed");
      expect(result).toContain("12s");
      expect(result).toContain("Unresolved reference");
      expect(result).toContain("build-x1y2z3");
    });
  });

  describe("formatTestResults", () => {
    it("formats test results with failures", () => {
      const result = formatTestResults({
        passed: 47,
        failed: 2,
        skipped: 0,
        duration: "18s",
        failures: [
          "LoginViewModelTest.testInvalidEmail",
          "LoginRepositoryTest.testNetworkError",
        ],
        cacheId: "test-d4e5f6",
      });

      expect(result).toContain("47 passed");
      expect(result).toContain("2 failed");
      expect(result).toContain("18s");
      expect(result).toContain("LoginViewModelTest");
      expect(result).toContain("test-d4e5f6");
    });
  });

  describe("formatUiDump", () => {
    it("formats UI tree with interactive elements", () => {
      const result = formatUiDump({
        screenName: "MainActivity",
        elements: [
          { index: 0, type: "TextView", text: "Welcome back" },
          { index: 1, type: "EditText", hint: "email input", focused: true },
          { index: 2, type: "EditText", hint: "password input" },
          { index: 3, type: "Button", text: "Login" },
        ],
      });

      expect(result).toContain("MainActivity");
      expect(result).toContain("[0] TextView");
      expect(result).toContain("Welcome back");
      expect(result).toContain("[3] Button");
      expect(result).toContain("Login");
      expect(result).toContain("4 interactive elements");
    });
  });

  describe("formatLogcat", () => {
    it("formats error logs with count", () => {
      const result = formatLogcat({
        level: "error",
        count: 3,
        lines: [
          "E/ProfileActivity: NullPointerException at onCreate:47",
          "E/NetworkClient: Connection timeout after 30s",
          "E/CrashHandler: Fatal exception in main thread",
        ],
        cacheId: "logs-g7h8i9",
      });

      expect(result).toContain("3 errors");
      expect(result).toContain("NullPointerException");
      expect(result).toContain("logs-g7h8i9");
    });
  });

  describe("formatDeviceList", () => {
    it("formats device list with selection indicator", () => {
      const result = formatDeviceList({
        devices: [
          { id: "emulator-5554", name: "Pixel_7_API_34", state: "device", selected: true },
          { id: "abc123", name: "Physical Device", state: "device", selected: false },
        ],
      });

      expect(result).toContain("emulator-5554");
      expect(result).toContain("→"); // selection indicator
      expect(result).toContain("abc123");
    });
  });
});
