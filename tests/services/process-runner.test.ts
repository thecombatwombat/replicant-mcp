import { describe, it, expect } from "vitest";
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
  });
});
