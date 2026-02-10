import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execa } from "execa";
import { ProcessRunner } from "../../src/services/process-runner.js";

// Keep a reference to the real execa for restoring after mock overrides
const { execa: realExeca } = await vi.importActual<typeof import("execa")>("execa");

// Mock execa at module scope so ProcessRunner gets the spy.
// Default implementation delegates to the real execa; shell-payload
// test blocks override it to prevent real adb execution on emulator CI.
vi.mock("execa", async (importOriginal) => {
  const mod = await importOriginal<typeof import("execa")>();
  return { ...mod, execa: vi.fn().mockImplementation(mod.execa) };
});

const mockedExeca = vi.mocked(execa);

describe("ProcessRunner", () => {
  const runner = new ProcessRunner();

  describe("run", () => {
    beforeEach(() => {
      mockedExeca.mockImplementation(realExeca as any);
    });

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

  describe("shell payload safety guards", () => {
    beforeEach(() => {
      mockedExeca.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 } as any);
    });

    afterEach(() => {
      mockedExeca.mockImplementation(realExeca as any);
    });

    it("blocks rm -rf / in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "rm -rf /"])
      ).rejects.toThrow("Shell command 'rm -rf /' is not allowed");
    });

    it("blocks reboot in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "reboot"])
      ).rejects.toThrow("Shell command 'reboot' is not allowed");
    });

    it("blocks su in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "su -c id"])
      ).rejects.toThrow("Shell command 'su -c id' is not allowed");
    });

    it("blocks bare su in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "su"])
      ).rejects.toThrow("Shell command 'su' is not allowed");
    });

    it("blocks sudo in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "sudo rm -rf /data"])
      ).rejects.toThrow("Shell command 'sudo rm -rf /data' is not allowed");
    });

    it("blocks setprop persist in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "setprop persist.sys.timezone GMT"])
      ).rejects.toThrow("Shell command 'setprop persist.sys.timezone GMT' is not allowed");
    });

    it("blocks dd in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "dd if=/dev/zero of=/dev/block/mmcblk0"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks mkfs in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "mkfs.ext4 /dev/block/mmcblk0"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks wipe in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "wipe data"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks flash in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "flash system system.img"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks recovery in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "recovery --wipe_data"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks format in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "format /dev/block/mmcblk0"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks rm -rf /system in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "rm -rf /system"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks rm -rf /vendor in adb shell payload", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "rm -rf /vendor"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks rm on /system subdirectories", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "rm -rf /system/app"])
      ).rejects.toThrow("is not allowed");
    });

    it("blocks multi-arg shell payloads with dangerous commands", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "rm", "-rf", "/"])
      ).rejects.toThrow("Shell command 'rm -rf /' is not allowed");
    });

    it("allows rm on safe paths like /sdcard", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "rm /sdcard/ui-dump.xml"]);
    });

    it("allows rm on /data/local/tmp", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "rm /data/local/tmp/test.txt"]);
    });

    it("allows safe shell commands", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "ls /data"]);
    });

    it("allows safe shell commands like getprop", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "getprop"]);
    });

    it("allows setprop for non-persist properties", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "setprop debug.test true"]);
    });

    it("allows pm list packages", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "pm", "list", "packages"]);
    });

    it("skips validation when no shell arg present", async () => {
      await runner.run("adb", ["devices"]);
    });

    it("skips validation when shell is last arg with no payload", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell"]);
    });
  });

  describe("shell metacharacter and bypass prevention", () => {
    beforeEach(() => {
      mockedExeca.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 } as any);
    });

    afterEach(() => {
      mockedExeca.mockImplementation(realExeca as any);
    });

    it("blocks semicolon command chaining", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "ls; rm -rf /"])
      ).rejects.toThrow("Shell metacharacters are not allowed");
    });

    it("blocks && command chaining", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "echo x && reboot"])
      ).rejects.toThrow("Shell metacharacters are not allowed");
    });

    it("blocks || command chaining", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "true || dd if=/dev/zero of=/dev/block/mmcblk0"])
      ).rejects.toThrow("Shell metacharacters are not allowed");
    });

    it("blocks pipe operator", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "cat /dev/null | su"])
      ).rejects.toThrow("Shell metacharacters are not allowed");
    });

    it("blocks backtick command substitution", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "echo `reboot`"])
      ).rejects.toThrow("Shell metacharacters are not allowed");
    });

    it("blocks $() command substitution", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "echo $(rm -rf /system)"])
      ).rejects.toThrow("Shell metacharacters are not allowed");
    });

    it("blocks $ variable expansion", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "echo $PATH"])
      ).rejects.toThrow("Shell metacharacters are not allowed");
    });

    it("blocks dangerous commands after -- separator", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "--", "reboot"])
      ).rejects.toThrow("Shell command 'reboot' is not allowed");
    });

    it("blocks rm -rf / after -- separator", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "--", "rm -rf /"])
      ).rejects.toThrow("Shell command 'rm -rf /' is not allowed");
    });

    it("blocks sh -c wrapper", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "sh -c 'rm -rf /'"])
      ).rejects.toThrow("Shell interpreters with -c are not allowed");
    });

    it("blocks bash -c wrapper", async () => {
      await expect(
        runner.run("adb", ["-s", "emulator-5554", "shell", "bash -c 'reboot'"])
      ).rejects.toThrow("Shell interpreters with -c are not allowed");
    });

    it("allows input text with quoted strings (no metacharacters)", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", 'input text "hello world"']);
    });

    it("allows screencap commands", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "screencap -p /sdcard/screenshot.png"]);
    });

    it("allows uiautomator dump", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "uiautomator dump /sdcard/ui-dump.xml"]);
    });

    it("allows input tap commands", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "input tap 100 200"]);
    });

    it("allows wm size command", async () => {
      await runner.run("adb", ["-s", "emulator-5554", "shell", "wm size"]);
    });

    it("does not apply shell validation to non-adb commands with 'shell' in args", async () => {
      await runner.run("echo", ["shell", "rm -rf /"]);
    });

    it("applies shell validation when adb is a full path", async () => {
      await expect(
        runner.run("/usr/bin/adb", ["-s", "emulator-5554", "shell", "reboot"])
      ).rejects.toThrow("Shell command 'reboot' is not allowed");
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
