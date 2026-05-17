// Regression test for THE-105: visual-snapshot was failing in production with
// COMMAND_BLOCKED because getCurrentApp built shell commands containing `|`,
// which the production shell safety guard correctly rejects.
//
// This test wires the *real* ProcessRunner (which enforces the safety guard)
// into a real AdbAdapter into a real UiAutomatorAdapter, mocking only execa at
// the bottom of the stack. If anyone re-introduces shell metacharacters into
// the visual-snapshot code path, ProcessRunner.validateCommand will throw and
// this test will fail at the same layer where production fails today.

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above all other top-level statements, so the mock
// implementation must use vi.hoisted to access shared state.
const { execaMock } = vi.hoisted(() => ({ execaMock: vi.fn() }));
vi.mock("execa", () => ({
  execa: execaMock,
  ExecaError: class ExecaError extends Error {},
}));

import { ProcessRunner } from "../../src/services/process-runner.js";
import { AdbAdapter } from "../../src/adapters/adb.js";
import { UiAutomatorAdapter } from "../../src/adapters/ui-automator.js";

describe("visual-snapshot shell-safety regression (THE-105)", () => {
  beforeEach(() => {
    execaMock.mockReset();
  });

  function stubExecaForGetCurrentApp(activitiesStdout: string, windowStdout: string): void {
    // execa is called as execa(command, args, options). The args look like:
    //   ["-s", "emulator-5554", "shell", "dumpsys activity activities"]
    execaMock.mockImplementation(async (_cmd: string, args: string[]) => {
      const shellIdx = args.indexOf("shell");
      const shellPayload = shellIdx === -1 ? "" : args[shellIdx + 1] ?? "";
      switch (shellPayload) {
        case "dumpsys activity activities":
          return { stdout: activitiesStdout, stderr: "", exitCode: 0 };
        case "dumpsys window":
          return { stdout: windowStdout, stderr: "", exitCode: 0 };
        default:
          return { stdout: "", stderr: "", exitCode: 0 };
      }
    });
  }

  it("getCurrentApp runs through the real safety guard without COMMAND_BLOCKED and parses the result", async () => {
    stubExecaForGetCurrentApp(
      `      mResumedActivity: ActivityRecord{abc u0 com.real.app/.RealActivity t1}\n`,
      ""
    );

    const runner = new ProcessRunner();
    const adb = new AdbAdapter(runner);
    const ui = new UiAutomatorAdapter(adb);

    const app = await ui.getCurrentApp("emulator-5554");

    expect(app).toEqual({
      packageName: "com.real.app",
      activityName: ".RealActivity",
    });

    // Sanity: every shell payload we sent past the safety guard was free of
    // the characters validateShellPayload rejects.
    const blocked = /[;&|`()]|\$[({a-zA-Z_]/;
    for (const call of execaMock.mock.calls) {
      const args = call[1] as string[];
      const shellIdx = args.indexOf("shell");
      if (shellIdx === -1) continue;
      const payload = args.slice(shellIdx + 1).join(" ");
      expect(payload).not.toMatch(blocked);
    }
  });

  it("falls back to dumpsys window when the activities dump has no mResumedActivity", async () => {
    stubExecaForGetCurrentApp(
      "  (no resumed activity)\n",
      "  mCurrentFocus=Window{def u0 com.fallback/.FallbackActivity}\n"
    );

    const runner = new ProcessRunner();
    const adb = new AdbAdapter(runner);
    const ui = new UiAutomatorAdapter(adb);

    const app = await ui.getCurrentApp("emulator-5554");

    expect(app).toEqual({
      packageName: "com.fallback",
      activityName: ".FallbackActivity",
    });
  });
});
