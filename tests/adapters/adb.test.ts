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

  describe("transient-error retry", () => {
    const offlineResult = { stdout: "", stderr: "error: device offline", exitCode: 1 } as const;
    const noDevicesResult = { stdout: "error: no devices/emulators found\n", stderr: "", exitCode: 1 } as const;
    const notFoundResult = { stdout: "", stderr: "error: device '1234' not found", exitCode: 1 } as const;
    const unauthorizedResult = { stdout: "", stderr: "error: device unauthorized.", exitCode: 1 } as const;
    const successResult = { stdout: "ok", stderr: "", exitCode: 0 } as const;

    it("does not retry on success", async () => {
      mockRunner.runAdb.mockResolvedValueOnce(successResult);
      await adapter.shell("emulator-5554", "echo hi");
      expect(mockRunner.runAdb).toHaveBeenCalledTimes(1);
    });

    it("retries on 'device offline' and returns the second result", async () => {
      mockRunner.runAdb
        .mockResolvedValueOnce(offlineResult)
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // wait-for-device
        .mockResolvedValueOnce(successResult);
      const result = await adapter.shell("emulator-5554", "echo hi");
      expect(result.stdout).toBe("ok");
      expect(mockRunner.runAdb).toHaveBeenCalledTimes(3);
      expect(mockRunner.runAdb.mock.calls[1][0]).toEqual([
        "-s",
        "emulator-5554",
        "wait-for-device",
      ]);
    });

    it("retries on 'no devices/emulators found' (stdout)", async () => {
      mockRunner.runAdb
        .mockResolvedValueOnce(noDevicesResult)
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "List of devices attached\n", stderr: "", exitCode: 0 });
      await adapter.getDevices();
      expect(mockRunner.runAdb).toHaveBeenCalledTimes(3);
    });

    it("retries on \"device 'X' not found\"", async () => {
      mockRunner.runAdb
        .mockResolvedValueOnce(notFoundResult)
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce(successResult);
      await adapter.shell("1234", "ls");
      expect(mockRunner.runAdb).toHaveBeenCalledTimes(3);
    });

    it("does NOT retry on 'device unauthorized'", async () => {
      mockRunner.runAdb.mockResolvedValueOnce(unauthorizedResult);
      const result = await adapter.shell("emulator-5554", "ls");
      expect(result.exitCode).toBe(1);
      expect(mockRunner.runAdb).toHaveBeenCalledTimes(1);
    });

    it("retries at most once (returns second result even if also offline)", async () => {
      mockRunner.runAdb
        .mockResolvedValueOnce(offlineResult)
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce(offlineResult);
      const result = await adapter.shell("emulator-5554", "ls");
      expect(result.exitCode).toBe(1);
      expect(mockRunner.runAdb).toHaveBeenCalledTimes(3);
    });

    it("tolerates wait-for-device failure and still retries the original command", async () => {
      mockRunner.runAdb
        .mockResolvedValueOnce(offlineResult)
        .mockRejectedValueOnce(new Error("wait-for-device timed out"))
        .mockResolvedValueOnce(successResult);
      const result = await adapter.shell("emulator-5554", "ls");
      expect(result.exitCode).toBe(0);
      expect(mockRunner.runAdb).toHaveBeenCalledTimes(3);
    });

    it("carries -s <deviceId> into the retry's wait-for-device call", async () => {
      mockRunner.runAdb
        .mockResolvedValueOnce(offlineResult)
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce(successResult);
      await adapter.shell("emulator-5554", "echo hi");
      expect(mockRunner.runAdb.mock.calls[1][0]).toEqual([
        "-s",
        "emulator-5554",
        "wait-for-device",
      ]);
    });

    it("uses bare wait-for-device when the original command has no -s flag", async () => {
      mockRunner.runAdb
        .mockResolvedValueOnce(noDevicesResult)
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "List of devices attached\n", stderr: "", exitCode: 0 });
      await adapter.getDevices();
      expect(mockRunner.runAdb.mock.calls[1][0]).toEqual(["wait-for-device"]);
    });

    it("does NOT recursively wait when the original command is already wait-for-device", async () => {
      mockRunner.runAdb.mockResolvedValueOnce(notFoundResult);
      await expect(
        adapter.waitForDevice("ghost-device", 1000)
      ).resolves.toBeUndefined();
      expect(mockRunner.runAdb).toHaveBeenCalledTimes(1);
      expect(mockRunner.runAdb.mock.calls[0][0]).toEqual([
        "-s",
        "ghost-device",
        "wait-for-device",
      ]);
    });
  });
});
