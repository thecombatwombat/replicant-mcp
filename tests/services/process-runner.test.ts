import { describe, it, expect, vi } from "vitest";
import { ProcessRunner } from "../../src/services/process-runner.js";

describe("ProcessRunner", () => {
  const runner = new ProcessRunner();

  describe("run", () => {
    it("executes a simple command and returns output", async () => {
      const result = await runner.run("echo", ["hello"]);
      expect(result.stdout.trim()).toBe("hello");
      expect(result.exitCode).toBe(0);
    });

    it("returns stderr on command failure", async () => {
      const result = await runner.run("ls", ["/nonexistent-path-12345"]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    });

    it("times out long-running commands", async () => {
      await expect(
        runner.run("sleep", ["10"], { timeoutMs: 100 })
      ).rejects.toThrow("timed out");
    });
  });

  describe("safety guards", () => {
    it("blocks dangerous commands", async () => {
      await expect(runner.run("rm", ["-rf", "/"])).rejects.toThrow(
        "is not allowed"
      );
    });

    it("blocks reboot commands", async () => {
      await expect(runner.run("reboot", [])).rejects.toThrow("is not allowed");
    });

    it("blocks shutdown commands", async () => {
      await expect(runner.run("shutdown", [])).rejects.toThrow("is not allowed");
    });

    it("blocks su commands", async () => {
      await expect(runner.run("su", ["-c", "id"])).rejects.toThrow("is not allowed");
    });

    it("blocks sudo commands", async () => {
      await expect(runner.run("sudo", ["rm", "-rf", "/"])).rejects.toThrow("is not allowed");
    });
  });

  describe("runAdb", () => {
    it("uses environment service to resolve adb path", async () => {
      const mockEnv = {
        getAdbPath: vi.fn().mockResolvedValue("/custom/path/adb"),
      };
      const runnerWithEnv = new ProcessRunner(mockEnv as any);

      // This will fail because adb doesn't exist at that path, but we're testing the path resolution
      try {
        await runnerWithEnv.runAdb(["version"]);
      } catch {
        // Expected to fail
      }

      expect(mockEnv.getAdbPath).toHaveBeenCalled();
    });

    it("falls back to bare adb when no environment service", async () => {
      const runnerNoEnv = new ProcessRunner();

      // Should use "adb" directly, which may or may not be on PATH
      // We just verify it doesn't throw an error about missing environment
      try {
        await runnerNoEnv.runAdb(["version"]);
      } catch (error) {
        // May fail if adb not installed, but shouldn't fail due to environment service
        expect(error).not.toMatchObject({ code: "ADB_NOT_FOUND" });
      }
    });
  });
});
