import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseDeviceList, parsePackageList } from "../../src/parsers/adb-output.js";
import { AdbAdapter } from "../../src/adapters/adb.js";

describe("ADB Output Parsing", () => {
  describe("parseDeviceList", () => {
    it("parses device list output", () => {
      const output = `List of devices attached
emulator-5554\tdevice
192.168.1.100:5555\tdevice
`;
      const devices = parseDeviceList(output);
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        id: "emulator-5554",
        type: "emulator",
        name: "emulator-5554",
        status: "online",
      });
      expect(devices[1]).toEqual({
        id: "192.168.1.100:5555",
        type: "physical",
        name: "192.168.1.100:5555",
        status: "online",
      });
    });

    it("handles offline devices", () => {
      const output = `List of devices attached
emulator-5554\toffline
`;
      const devices = parseDeviceList(output);
      expect(devices[0].status).toBe("offline");
    });

    it("handles unauthorized devices", () => {
      const output = `List of devices attached
emulator-5554\tunauthorized
`;
      const devices = parseDeviceList(output);
      expect(devices[0].status).toBe("unauthorized");
    });

    it("handles empty device list", () => {
      const output = `List of devices attached

`;
      const devices = parseDeviceList(output);
      expect(devices).toHaveLength(0);
    });
  });

  describe("parsePackageList", () => {
    it("parses package list output", () => {
      const output = `package:com.example.app
package:com.android.chrome
package:com.google.android.gms
`;
      const packages = parsePackageList(output);
      expect(packages).toEqual([
        "com.example.app",
        "com.android.chrome",
        "com.google.android.gms",
      ]);
    });
  });
});

describe("AdbAdapter", () => {
  let mockRunner: { runAdb: ReturnType<typeof vi.fn> };
  let adapter: AdbAdapter;

  beforeEach(() => {
    mockRunner = { runAdb: vi.fn() };
    adapter = new AdbAdapter(mockRunner as any);
  });

  describe("logcat", () => {
    it("adds -T flag when since is provided", async () => {
      mockRunner.runAdb.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      await adapter.logcat("emulator-5554", { since: "01-20 15:30:00.000" });
      expect(mockRunner.runAdb).toHaveBeenCalledWith(
        expect.arrayContaining(["-T", "01-20 15:30:00.000"]),
        expect.anything()
      );
    });

    it("filters output lines by package name", async () => {
      mockRunner.runAdb.mockResolvedValue({
        stdout: "line1 com.example.app foo\nline2 com.other bar\nline3 com.example.app baz",
        stderr: "",
        exitCode: 0,
      });

      const output = await adapter.logcat("emulator-5554", { package: "com.example.app" });
      const lines = output.split("\n").filter(Boolean);
      expect(lines).toHaveLength(2);
      expect(lines.every((l) => l.includes("com.example.app"))).toBe(true);
    });

    it("returns empty string when no lines match package", async () => {
      mockRunner.runAdb.mockResolvedValue({
        stdout: "line1 com.other.app foo",
        stderr: "",
        exitCode: 0,
      });

      const output = await adapter.logcat("emulator-5554", { package: "com.example.app" });
      expect(output.trim()).toBe("");
    });

    it("passes -T before -t in args", async () => {
      mockRunner.runAdb.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      await adapter.logcat("emulator-5554", { lines: 100, since: "01-20 15:30:00.000" });
      const args = mockRunner.runAdb.mock.calls[0][0];
      const tUpperIdx = args.indexOf("-T");
      const tLowerIdx = args.indexOf("-t");
      expect(tUpperIdx).toBeLessThan(tLowerIdx);
    });

    it("works without since or package", async () => {
      mockRunner.runAdb.mockResolvedValue({
        stdout: "some log output",
        stderr: "",
        exitCode: 0,
      });

      const output = await adapter.logcat("emulator-5554", { lines: 50 });
      expect(output).toBe("some log output");
      expect(mockRunner.runAdb).toHaveBeenCalledWith(
        ["-s", "emulator-5554", "logcat", "-d", "-t", "50"],
        expect.anything()
      );
    });
  });

  describe("pull", () => {
    it("pulls file from device to local path", async () => {
      mockRunner.runAdb.mockResolvedValue({ stdout: "1 file pulled", stderr: "", exitCode: 0 });

      await adapter.pull("emulator-5554", "/sdcard/test.png", "/tmp/test.png");

      expect(mockRunner.runAdb).toHaveBeenCalledWith(
        ["-s", "emulator-5554", "pull", "/sdcard/test.png", "/tmp/test.png"],
        expect.anything()
      );
    });

    it("throws PULL_FAILED on error", async () => {
      mockRunner.runAdb.mockResolvedValue({ stdout: "", stderr: "error: device offline", exitCode: 1 });

      await expect(
        adapter.pull("emulator-5554", "/sdcard/test.png", "/tmp/test.png")
      ).rejects.toThrow("Failed to pull");
    });
  });

  describe("startIntent (CU-2 / THE-106)", () => {
    const okStdout = "Starting: Intent { act=android.intent.action.VIEW }\nStatus: ok\n";

    it("builds typed argv with -a action and -d URL containing `&`", async () => {
      mockRunner.runAdb.mockResolvedValue({ stdout: okStdout, stderr: "", exitCode: 0 });

      const result = await adapter.startIntent("emulator-5554", {
        action: "android.intent.action.VIEW",
        data: "https://example.com/?foo=bar&baz=qux",
      });

      expect(mockRunner.runAdb).toHaveBeenCalledWith(
        [
          "-s",
          "emulator-5554",
          "shell",
          "am",
          "start",
          "-W",
          "-a",
          "android.intent.action.VIEW",
          "-d",
          "https://example.com/?foo=bar&baz=qux",
        ],
        expect.anything(),
      );
      expect(result.ok).toBe(true);
      expect(result.status).toBe("ok");
    });

    it("omits -d when data is undefined", async () => {
      mockRunner.runAdb.mockResolvedValue({ stdout: okStdout, stderr: "", exitCode: 0 });

      await adapter.startIntent("emulator-5554", {
        action: "android.intent.action.MAIN",
      });

      const args = mockRunner.runAdb.mock.calls[0][0];
      expect(args).not.toContain("-d");
      expect(args).toEqual(
        expect.arrayContaining(["-a", "android.intent.action.MAIN"]),
      );
    });

    it("appends --es key value pairs for extras (each value its own arg)", async () => {
      mockRunner.runAdb.mockResolvedValue({ stdout: okStdout, stderr: "", exitCode: 0 });

      await adapter.startIntent("emulator-5554", {
        action: "android.intent.action.VIEW",
        extras: { url: "https://x.example/?a=1&b=2", note: "hello world" },
      });

      const args = mockRunner.runAdb.mock.calls[0][0];
      // URL extra value remains a single arg, embedded `&` survives.
      expect(args).toEqual(
        expect.arrayContaining([
          "--es",
          "url",
          "https://x.example/?a=1&b=2",
          "--es",
          "note",
          "hello world",
        ]),
      );
    });

    it("rejects an invalid action (spaces)", async () => {
      await expect(
        adapter.startIntent("emulator-5554", { action: "bad action with spaces" }),
      ).rejects.toThrow("Invalid intent action");
      expect(mockRunner.runAdb).not.toHaveBeenCalled();
    });

    it("rejects an action starting with a digit", async () => {
      await expect(
        adapter.startIntent("emulator-5554", { action: "1.bad" }),
      ).rejects.toThrow("Invalid intent action");
    });

    it("rejects data containing a null byte", async () => {
      await expect(
        adapter.startIntent("emulator-5554", {
          action: "android.intent.action.VIEW",
          data: "https://example.com/\0evil",
        }),
      ).rejects.toThrow("null byte");
    });

    it("rejects extras key with shell metacharacters", async () => {
      await expect(
        adapter.startIntent("emulator-5554", {
          action: "android.intent.action.VIEW",
          extras: { "bad key;reboot": "x" },
        }),
      ).rejects.toThrow("Invalid extras key");
    });

    it("rejects data over the length cap", async () => {
      const tooLong = "a".repeat(2049);
      await expect(
        adapter.startIntent("emulator-5554", {
          action: "android.intent.action.VIEW",
          data: tooLong,
        }),
      ).rejects.toThrow("exceeds");
    });

    it("rejects an invalid component spec", async () => {
      await expect(
        adapter.startIntent("emulator-5554", {
          action: "android.intent.action.MAIN",
          component: "not a component",
        }),
      ).rejects.toThrow("Invalid component");
    });

    it("accepts pkg/.RelativeActivity component", async () => {
      mockRunner.runAdb.mockResolvedValue({ stdout: okStdout, stderr: "", exitCode: 0 });

      await adapter.startIntent("emulator-5554", {
        action: "android.intent.action.MAIN",
        component: "com.example.app/.MainActivity",
      });

      const args = mockRunner.runAdb.mock.calls[0][0];
      expect(args).toEqual(
        expect.arrayContaining(["-n", "com.example.app/.MainActivity"]),
      );
    });

    it("returns ok=false when am start reports Error", async () => {
      mockRunner.runAdb.mockResolvedValue({
        stdout: "Error: Activity not started, unable to resolve Intent",
        stderr: "",
        exitCode: 0,
      });

      const result = await adapter.startIntent("emulator-5554", {
        action: "android.intent.action.VIEW",
        data: "https://example.com/",
      });

      expect(result.ok).toBe(false);
    });

    it("throws when am start fails with non-zero exit", async () => {
      mockRunner.runAdb.mockResolvedValue({
        stdout: "",
        stderr: "adb: device offline",
        exitCode: 1,
      });

      await expect(
        adapter.startIntent("emulator-5554", {
          action: "android.intent.action.VIEW",
          data: "https://example.com/",
        }),
      ).rejects.toThrow("am start failed");
    });
  });
});
