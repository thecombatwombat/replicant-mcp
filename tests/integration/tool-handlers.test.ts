/**
 * Tool Handler Integration Tests
 *
 * These tests verify that tools work correctly with mocked CLI adapters.
 * They test the full flow from tool input to structured output.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServerContext, ServerContext } from "../../src/server.js";

// Mock execa to control CLI output
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
const mockedExeca = vi.mocked(execa);

describe("Tool Handler Integration", () => {
  let context: ServerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createServerContext();
  });

  describe("adb-device tool", () => {
    it("should list devices and auto-select single device", async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: `List of devices attached
emulator-5554\tdevice
`,
        stderr: "",
        exitCode: 0,
      } as any);

      const devices = await context.adb.getDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe("emulator-5554");
      expect(devices[0].type).toBe("emulator");
      expect(devices[0].status).toBe("online");
    });

    it("should parse multiple devices", async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: `List of devices attached
emulator-5554\tdevice
192.168.1.100:5555\tdevice
RF8M33XXXXX\tdevice
`,
        stderr: "",
        exitCode: 0,
      } as any);

      const devices = await context.adb.getDevices();

      expect(devices).toHaveLength(3);
      expect(devices[0].type).toBe("emulator");
      expect(devices[1].type).toBe("physical");
      expect(devices[2].type).toBe("physical");
    });

    it("should handle offline devices", async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: `List of devices attached
emulator-5554\toffline
`,
        stderr: "",
        exitCode: 0,
      } as any);

      const devices = await context.adb.getDevices();

      expect(devices[0].status).toBe("offline");
    });
  });

  describe("emulator-device tool", () => {
    it("should list available and running emulators", async () => {
      // Mock avdmanager list avd
      mockedExeca.mockResolvedValueOnce({
        stdout: `Available Android Virtual Devices:
    Name: Pixel_7_API_34
    Path: /Users/test/.android/avd/Pixel_7_API_34.avd
  Target: Google APIs
`,
        stderr: "",
        exitCode: 0,
      } as any);

      // Mock emulator -list-avds
      mockedExeca.mockResolvedValueOnce({
        stdout: `emulator-5554
`,
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await context.emulator.list();

      expect(result.available).toHaveLength(1);
      expect(result.available[0].name).toBe("Pixel_7_API_34");
      expect(result.running).toContain("emulator-5554");
    });
  });

  describe("gradle-build tool", () => {
    it("should parse successful build output", async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: `> Task :app:assembleDebug

BUILD SUCCESSFUL in 47s
42 actionable tasks: 42 executed
`,
        stderr: "",
        exitCode: 0,
      } as any);

      const { result, fullOutput } = await context.gradle.build("assembleDebug");

      expect(result.success).toBe(true);
      expect(result.duration).toBe("47s");
      expect(result.tasksExecuted).toBe(42);
      expect(fullOutput).toContain("BUILD SUCCESSFUL");
    });

    it("should throw on build failure", async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: `> Task :app:compileDebugKotlin FAILED

BUILD FAILED in 12s
`,
        stderr: "",
        exitCode: 1,
      } as any);

      await expect(context.gradle.build("assembleDebug")).rejects.toThrow("Build failed");
    });

    it("should count warnings", async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: `w: Some warning
w: Another warning
w: Third warning

BUILD SUCCESSFUL in 5s
10 actionable tasks
`,
        stderr: "",
        exitCode: 0,
      } as any);

      const { result } = await context.gradle.build("assembleDebug");

      expect(result.warnings).toBe(3);
    });
  });

  describe("gradle-test tool", () => {
    it("should parse test results", async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: `> Task :app:testDebugUnitTest

com.example.MyTest > testOne PASSED
com.example.MyTest > testTwo PASSED
com.example.MyTest > testThree FAILED

3 tests completed, 1 failed
`,
        stderr: "",
        exitCode: 0,
      } as any);

      const { result } = await context.gradle.test("unitTest");

      expect(result.total).toBe(3);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe("adb-logcat tool", () => {
    it("should retrieve logcat output", async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: `01-20 10:00:00.000  1234  1234 E MyApp   : Error message
01-20 10:00:01.000  1234  1234 W MyApp   : Warning message
01-20 10:00:02.000  1234  1234 I MyApp   : Info message
`,
        stderr: "",
        exitCode: 0,
      } as any);

      // Need to set current device first
      context.deviceState.setCurrentDevice({
        id: "emulator-5554",
        type: "emulator",
        name: "Test",
        status: "online",
      });

      const output = await context.adb.logcat("emulator-5554", { lines: 100 });

      expect(output).toContain("Error message");
      expect(output).toContain("Warning message");
    });
  });

  describe("ui tool", () => {
    it("should parse UI dump", async () => {
      // Mock uiautomator dump
      mockedExeca.mockResolvedValueOnce({
        stdout: "UI hierchary dumped to: /sdcard/ui-dump.xml",
        stderr: "",
        exitCode: 0,
      } as any);

      // Mock cat to get XML
      mockedExeca.mockResolvedValueOnce({
        stdout: `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
    <node index="0" text="Hello World" resource-id="com.example:id/text" class="android.widget.TextView" bounds="[100,200][300,250]" />
    <node index="1" text="Login" resource-id="com.example:id/button" class="android.widget.Button" bounds="[100,300][300,350]" clickable="true" />
  </node>
</hierarchy>`,
        stderr: "",
        exitCode: 0,
      } as any);

      // Mock rm cleanup
      mockedExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
      } as any);

      const tree = await context.ui.dump("emulator-5554");

      expect(tree).toHaveLength(1);
      expect(tree[0].className).toBe("android.widget.FrameLayout");
    });

    it("should find elements by selector", async () => {
      // Mock uiautomator dump
      mockedExeca.mockResolvedValueOnce({
        stdout: "UI hierchary dumped",
        stderr: "",
        exitCode: 0,
      } as any);

      // Mock cat
      mockedExeca.mockResolvedValueOnce({
        stdout: `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy>
  <node index="0" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
    <node index="0" text="Login" resource-id="com.example:id/login_btn" class="android.widget.Button" bounds="[100,300][300,350]" />
    <node index="1" text="Sign Up" resource-id="com.example:id/signup_btn" class="android.widget.Button" bounds="[400,300][600,350]" />
  </node>
</hierarchy>`,
        stderr: "",
        exitCode: 0,
      } as any);

      // Mock rm
      mockedExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
      } as any);

      const elements = await context.ui.find("emulator-5554", { text: "Login" });

      expect(elements).toHaveLength(1);
      expect(elements[0].text).toBe("Login");
      expect(elements[0].resourceId).toBe("com.example:id/login_btn");
    });
  });

  describe("Cache Integration", () => {
    it("should cache and retrieve build output", async () => {
      const cacheId = context.cache.generateId("build");
      const buildOutput = {
        success: true,
        duration: "30s",
        warnings: 0,
        errors: 0,
      };

      context.cache.set(cacheId, buildOutput, "build");

      const retrieved = context.cache.get(cacheId);
      expect(retrieved?.data).toEqual(buildOutput);
    });

    it("should invalidate cache by type", async () => {
      const buildId = context.cache.generateId("build");
      const testId = context.cache.generateId("test");

      context.cache.set(buildId, { type: "build" }, "build");
      context.cache.set(testId, { type: "test" }, "test");

      context.cache.invalidateByType("build");

      expect(context.cache.get(buildId)).toBeUndefined();
      expect(context.cache.get(testId)).toBeDefined();
    });
  });

  describe("Device State Integration", () => {
    it("should require device selection for device-dependent operations", () => {
      expect(() => context.deviceState.requireCurrentDevice()).toThrow("No device selected");
    });

    it("should auto-select single device", async () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "Test", status: "online" as const },
      ];

      const selected = context.deviceState.autoSelectIfSingle(devices);

      expect(selected).toBe(true);
      expect(context.deviceState.getCurrentDevice()?.id).toBe("emulator-5554");
    });

    it("should not auto-select with multiple devices", () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "Test1", status: "online" as const },
        { id: "emulator-5556", type: "emulator" as const, name: "Test2", status: "online" as const },
      ];

      const selected = context.deviceState.autoSelectIfSingle(devices);

      expect(selected).toBe(false);
      expect(context.deviceState.getCurrentDevice()).toBeNull();
    });
  });
});

describe("Error Handling Integration", () => {
  let context: ServerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createServerContext();
  });

  describe("Safety Guards", () => {
    it("should block dangerous commands", async () => {
      await expect(context.processRunner.run("rm", ["-rf", "/"])).rejects.toThrow("not allowed");
    });

    it("should block reboot commands", async () => {
      await expect(context.processRunner.run("reboot", [])).rejects.toThrow("not allowed");
    });

    it("should block sudo commands", async () => {
      await expect(context.processRunner.run("sudo", ["rm", "-rf", "/"])).rejects.toThrow("not allowed");
    });
  });

  describe("Timeout Handling", () => {
    it("should timeout long-running commands", async () => {
      mockedExeca.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("timed out after 100ms")), 100);
        });
      });

      await expect(
        context.processRunner.run("sleep", ["10"], { timeoutMs: 100 })
      ).rejects.toThrow("timed out");
    });
  });
});
