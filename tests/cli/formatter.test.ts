import { describe, it, expect } from "vitest";
import { formatBuildSuccess, formatBuildFailure, formatTestResults } from "../../src/cli/formatter.js";

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
});
