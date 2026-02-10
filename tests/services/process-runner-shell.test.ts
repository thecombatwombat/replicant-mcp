import { describe, it, expect } from "vitest";
import { ProcessRunner } from "../../src/services/process-runner.js";

// Mock execa to prevent real adb execution on emulator CI.
// File-scoped: only affects this file. process-runner.test.ts uses real execa.
vi.mock("execa", async (importOriginal) => {
  const mod = await importOriginal<typeof import("execa")>();
  return {
    ...mod,
    execa: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
  };
});

describe("ProcessRunner shell payload safety guards", () => {
  const runner = new ProcessRunner();

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

  it("blocks rm -rf /oem", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "rm -rf /oem"])
    ).rejects.toThrow("is not allowed");
  });

  it("blocks rm -rf /product", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "rm -rf /product"])
    ).rejects.toThrow("is not allowed");
  });

  it("blocks rm /system without flags", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "rm /system"])
    ).rejects.toThrow("is not allowed");
  });

  it("blocks rm -r / with single flag", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "rm -r /"])
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

describe("ProcessRunner shell metacharacter and bypass prevention", () => {
  const runner = new ProcessRunner();

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

  it("blocks dash -c wrapper", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "dash -c 'reboot'"])
    ).rejects.toThrow("Shell interpreters with -c are not allowed");
  });

  it("blocks zsh -c wrapper", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "zsh -c 'reboot'"])
    ).rejects.toThrow("Shell interpreters with -c are not allowed");
  });

  it("blocks ${VAR} expansion", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo ${PATH}"])
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("blocks standalone subshell parenthesis", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "(reboot)"])
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("blocks $_ underscore variable expansion", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo $_HOME"])
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("allows input text with quoted strings (no metacharacters)", async () => {
    await runner.run("adb", ["-s", "emulator-5554", "shell", 'input text "hello world"']);
  });

  it("allows dollar sign before digits in text input", async () => {
    await runner.run("adb", ["-s", "emulator-5554", "shell", "input text '$100'"]);
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
