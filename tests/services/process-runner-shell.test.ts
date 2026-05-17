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

  it("blocks single & followed by space (trailing chain operator, CU-2 follow-up)", async () => {
    // Codex flagged that `echo ok& reboot` passed the guard because a single
    // `&` was only rejected at the start of an arg. Device shell tokenises
    // on `&` regardless of position, so the first command backgrounds and
    // the second runs — bypassing the dangerous-command list.
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo ok& reboot"])
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("blocks single & at end of arg (trailing backgrounding)", async () => {
    // Use `echo done` rather than `reboot` so the rejection comes from the
    // metacharacter guard, not the BLOCKED_SHELL_PATTERNS reboot rule.
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo done &"])
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("blocks single & surrounded by spaces", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo a & echo b"])
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still allows single & between non-whitespace (URL query strings)", async () => {
    // Defence-in-depth: the CU-2 part 1 design lets URLs with `?a=1&b=2`
    // flow through as data. The trailing-& fix must not regress this.
    await runner.run("adb", [
      "-s", "emulator-5554", "shell", "am", "start", "-W",
      "-a", "android.intent.action.VIEW",
      "-d", "'https://example.com/?foo=bar&baz=qux'",
    ]);
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

// CU-2 (THE-106): the previous joined-string guard rejected URLs containing
// `&` (and other embedded metacharacters), even though execa passes the URL
// as a single argv entry — never through a shell. The per-arg guard allows
// the URL through while still blocking real chains.
describe("ProcessRunner shell payload — argv-aware metacharacter check (CU-2)", () => {
  const runner = new ProcessRunner();

  it("allows a single-quoted URL with `?` and `&` inside a single arg (data URI)", async () => {
    // Post-F3, `AdbAdapter.startIntent` wraps user-controlled URL values in
    // single quotes via `quoteForDeviceShell` so the device shell treats the
    // URL as a literal token. The guard mirrors that quoting contract.
    await runner.run("adb", [
      "-s",
      "emulator-5554",
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      "'https://example.com/?foo=bar&baz=qux'",
    ]);
  });

  it("allows multiple `&`s embedded in a single-quoted long URL", async () => {
    await runner.run("adb", [
      "-s",
      "emulator-5554",
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      "'https://example.com/path?a=1&b=2&c=3&d=4'",
    ]);
  });

  it("still blocks `&&` chain inside a single arg", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo a&&reboot"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still blocks a leading `&&` operator as its own arg", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo", "x", "&&", "reboot"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still blocks `||` chain across args (joined)", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo", "x", "||", "reboot"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still blocks `;` chain across args", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "ls", ";", "reboot"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still blocks pipe with whitespace `cat foo | su`", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "cat /dev/null | su"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still blocks `$VAR` expansion inside a single arg", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo $PATH"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still blocks `$(...)` substitution inside a single arg", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo", "$(reboot)"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still blocks backticks", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo", "`reboot`"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("still blocks `${VAR}` expansion", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo", "${PATH}"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("blocks an arg that starts with `&` (chain operator at start of arg)", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo", "&reboot"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("allows the literal `$` before digits (e.g., `$100`)", async () => {
    await runner.run("adb", [
      "-s",
      "emulator-5554",
      "shell",
      "input",
      "text",
      "'$100'",
    ]);
  });

  it("allows query params with `=` and `&` for typed-intent argv-style use", async () => {
    // This mirrors how `AdbAdapter.startIntent` builds argv post-F3: each
    // option pair is a separate arg, and user-controlled values (URL, extras)
    // are wrapped in single quotes via `quoteForDeviceShell` so the device
    // shell sees them as literal tokens. The argv-aware guard must therefore
    // treat `&` inside a single-quoted span as data.
    await runner.run("adb", [
      "-s",
      "emulator-5554",
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      "'https://example.com/?utm_source=replicant&utm_medium=mcp'",
      "--es",
      "key1",
      "'value with spaces'",
      "--es",
      "url",
      "'https://other.example/?x=1&y=2'",
    ]);
  });

  // CU-2 follow-up #2 (Codex P1): the previous `(?<!&)&(\s|$)` regex only
  // caught `&` followed by whitespace/EOA. `/bin/sh` treats an UNQUOTED `&`
  // as a control operator regardless of what follows — `echo ok&PWNED` glues
  // a backgrounded `echo` to a second command. We can't fix this with a
  // tighter regex because the legitimate F3 flow passes URLs containing
  // `&` between alphanumerics inside single quotes. The fix is a quote-aware
  // scanner: any `&` outside `'...'` / `"..."` (and not part of `&&`) is
  // composition and rejected.
  it("blocks single & glued to next command word (echo ok&PWNED)", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "echo ok&PWNED"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("blocks & followed by a digit (cmd&5 — data-looking glue)", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "cmd&5"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("blocks & followed by a letter (cmd&x — data-looking glue)", async () => {
    await expect(
      runner.run("adb", ["-s", "emulator-5554", "shell", "cmd&x"]),
    ).rejects.toThrow("Shell metacharacters are not allowed");
  });

  it("allows & inside a single-quoted URL token", async () => {
    // Mirrors the F3-wrapped value `AdbAdapter.startIntent` emits.
    await runner.run("adb", [
      "-s",
      "emulator-5554",
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      "'https://x/?a=1&b=2'",
    ]);
  });

  it("allows & inside a double-quoted span", async () => {
    // The typed-intent path uses single quotes, but the scanner honours
    // double quotes too for symmetry with /bin/sh's quoting rules.
    await runner.run("adb", [
      "-s",
      "emulator-5554",
      "shell",
      'echo "ok & noop"',
    ]);
  });
});
