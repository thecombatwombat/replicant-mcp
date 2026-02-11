import { describe, it, expect, beforeEach } from "vitest";
import { handleCacheTool } from "../../src/tools/cache.js";
import { handleRtfmTool } from "../../src/tools/rtfm.js";
import { CacheManager } from "../../src/services/index.js";
import {
  CacheGetStatsOutput,
  CacheClearAllOutput,
  CacheClearKeyOutput,
  CacheGetConfigOutput,
  RtfmOutput,
  AdbAppInstallOutput,
  AdbAppUninstallOutput,
  AdbAppLaunchOutput,
  AdbAppStopOutput,
  AdbAppClearDataOutput,
  AdbAppListOutput,
  AdbDeviceListOutput,
  AdbDeviceSelectOutput,
  AdbDeviceWaitOutput,
  AdbDevicePropertiesOutput,
  AdbDeviceHealthCheckOutput,
  AdbLogcatOutput,
  AdbShellOutput,
  EmulatorListOutput,
  EmulatorCreateOutput,
  EmulatorStartOutput,
  EmulatorKillOutput,
  EmulatorWipeOutput,
  EmulatorSnapshotSaveOutput,
  EmulatorSnapshotLoadOutput,
  EmulatorSnapshotListOutput,
  EmulatorSnapshotDeleteOutput,
  GradleBuildOutput,
  GradleTestRunOutput,
  GradleTestSaveBaselineOutput,
  GradleTestClearBaselineOutput,
  GradleListModulesOutput,
  GradleListVariantsOutput,
  GradleListTasksOutput,
  GradleGetDetailsLogsOutput,
  GradleGetDetailsErrorsOutput,
  GradleGetDetailsTasksOutput,
  GradleGetDetailsAllOutput,
  UiDumpFullOutput,
  UiDumpCompactOutput,
  UiFindOutput,
  UiTapOutput,
  UiInputOutput,
  UiScrollOutput,
} from "../../src/types/schemas/index.js";

// ─── Deterministic tools (no Android SDK needed) ──────────────────────

describe("cache output schema validation", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager();
  });

  it("get-stats output matches schema", async () => {
    cache.set("test-1", { data: 1 }, "test");
    const result = await handleCacheTool({ operation: "get-stats" }, cache);
    expect(() => CacheGetStatsOutput.parse(result)).not.toThrow();
  });

  it("clear all output matches schema", async () => {
    const result = await handleCacheTool({ operation: "clear" }, cache);
    expect(() => CacheClearAllOutput.parse(result)).not.toThrow();
  });

  it("clear specific key output matches schema", async () => {
    cache.set("my-key", { data: 1 }, "test");
    const result = await handleCacheTool({ operation: "clear", key: "my-key" }, cache);
    expect(() => CacheClearKeyOutput.parse(result)).not.toThrow();
  });

  it("get-config output matches schema", async () => {
    const result = await handleCacheTool({ operation: "get-config" }, cache);
    expect(() => CacheGetConfigOutput.parse(result)).not.toThrow();
  });

  it("set-config output matches schema", async () => {
    const result = await handleCacheTool(
      { operation: "set-config", config: { maxEntries: 50 } },
      cache,
    );
    expect(() => CacheGetConfigOutput.parse(result)).not.toThrow();
  });
});

describe("rtfm output schema validation", () => {
  it("index output matches schema", async () => {
    const result = await handleRtfmTool({});
    expect(() => RtfmOutput.parse(result)).not.toThrow();
  });

  it("category output matches schema", async () => {
    const result = await handleRtfmTool({ category: "build" });
    expect(() => RtfmOutput.parse(result)).not.toThrow();
  });

  it("tool output matches schema", async () => {
    const result = await handleRtfmTool({ tool: "cache" });
    expect(() => RtfmOutput.parse(result)).not.toThrow();
  });

  it("unknown category output matches schema", async () => {
    const result = await handleRtfmTool({ category: "nonexistent" });
    expect(() => RtfmOutput.parse(result)).not.toThrow();
  });
});

// ─── Environment-dependent tools (mock outputs) ───────────────────────

describe("adb-app output schema validation", () => {
  it("install output matches schema", () => {
    const mockOutput = { installed: "/path/to/app.apk", deviceId: "emulator-5554" };
    expect(() => AdbAppInstallOutput.parse(mockOutput)).not.toThrow();
  });

  it("uninstall output matches schema", () => {
    const mockOutput = { uninstalled: "com.example.app", deviceId: "emulator-5554" };
    expect(() => AdbAppUninstallOutput.parse(mockOutput)).not.toThrow();
  });

  it("launch output matches schema", () => {
    const mockOutput = { launched: "com.example.app", deviceId: "emulator-5554" };
    expect(() => AdbAppLaunchOutput.parse(mockOutput)).not.toThrow();
  });

  it("stop output matches schema", () => {
    const mockOutput = { stopped: "com.example.app", deviceId: "emulator-5554" };
    expect(() => AdbAppStopOutput.parse(mockOutput)).not.toThrow();
  });

  it("clear-data output matches schema", () => {
    const mockOutput = { cleared: "com.example.app", deviceId: "emulator-5554" };
    expect(() => AdbAppClearDataOutput.parse(mockOutput)).not.toThrow();
  });

  it("list output matches schema", () => {
    const mockOutput = {
      packages: ["com.example.app", "com.android.settings"],
      count: 2,
      totalCount: 50,
      hasMore: true,
      offset: 0,
      limit: 20,
      cacheId: "app-list-abc123-1234567890",
      deviceId: "emulator-5554",
    };
    expect(() => AdbAppListOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("adb-device output schema validation", () => {
  it("list output matches schema", () => {
    const mockOutput = {
      devices: [
        { id: "emulator-5554", type: "emulator" as const, name: "Pixel_7_API_34", status: "online" as const },
      ],
      currentDevice: "emulator-5554",
      autoSelected: true,
    };
    expect(() => AdbDeviceListOutput.parse(mockOutput)).not.toThrow();
  });

  it("select output matches schema", () => {
    const mockOutput = {
      selected: { id: "emulator-5554", type: "emulator" as const, name: "Pixel_7_API_34", status: "online" as const },
    };
    expect(() => AdbDeviceSelectOutput.parse(mockOutput)).not.toThrow();
  });

  it("wait output matches schema", () => {
    const mockOutput = { status: "device ready" as const, deviceId: "emulator-5554" };
    expect(() => AdbDeviceWaitOutput.parse(mockOutput)).not.toThrow();
  });

  it("properties output matches schema", () => {
    const mockOutput = {
      deviceId: "emulator-5554",
      summary: {
        model: "Pixel 7",
        manufacturer: "Google",
        sdkVersion: "34",
        androidVersion: "14",
        buildId: "UP1A.231005.007",
        device: "panther",
        product: "panther",
        hardware: "tensor",
        abiList: "arm64-v8a",
      },
      propertyCount: 150,
      cacheId: "device-props-abc123-1234567890",
    };
    expect(() => AdbDevicePropertiesOutput.parse(mockOutput)).not.toThrow();
  });

  it("health-check output matches schema", () => {
    const mockOutput = {
      healthy: true,
      environment: {
        sdkPath: "/Users/dev/Android/sdk",
        adbPath: "/Users/dev/Android/sdk/platform-tools/adb",
        platform: "darwin",
      },
      adbServerRunning: true,
      connectedDevices: 1,
      warnings: [],
      errors: [],
    };
    expect(() => AdbDeviceHealthCheckOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("adb-logcat output schema validation", () => {
  it("logcat output matches schema", () => {
    const mockOutput = {
      logId: "logcat-abc123-1234567890",
      summary: {
        lineCount: 100,
        errorCount: 2,
        warnCount: 5,
      },
      preview: "01-20 15:30:00.000 E AndroidRuntime: FATAL EXCEPTION\n01-20 15:30:00.001 I System: Boot completed",
      deviceId: "emulator-5554",
    };
    expect(() => AdbLogcatOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("adb-shell output schema validation", () => {
  it("shell output matches schema", () => {
    const mockOutput = {
      stdout: "package:com.example.app\n",
      stderr: "",
      exitCode: 0,
      deviceId: "emulator-5554",
    };
    expect(() => AdbShellOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("emulator-device output schema validation", () => {
  it("list output matches schema", () => {
    const mockOutput = { available: ["Pixel_7_API_34", "Pixel_6_API_33"], running: ["emulator-5554"] };
    expect(() => EmulatorListOutput.parse(mockOutput)).not.toThrow();
  });

  it("create output matches schema", () => {
    const mockOutput = { created: "Pixel_7_API_34" };
    expect(() => EmulatorCreateOutput.parse(mockOutput)).not.toThrow();
  });

  it("start output matches schema", () => {
    const mockOutput = { started: "Pixel_7_API_34", emulatorId: "emulator-5554", autoSelected: true as const };
    expect(() => EmulatorStartOutput.parse(mockOutput)).not.toThrow();
  });

  it("kill output matches schema", () => {
    const mockOutput = { killed: "emulator-5554" };
    expect(() => EmulatorKillOutput.parse(mockOutput)).not.toThrow();
  });

  it("wipe output matches schema", () => {
    const mockOutput = { wiped: "Pixel_7_API_34" };
    expect(() => EmulatorWipeOutput.parse(mockOutput)).not.toThrow();
  });

  it("snapshot-save output matches schema", () => {
    const mockOutput = { saved: "clean-state", emulatorId: "emulator-5554" };
    expect(() => EmulatorSnapshotSaveOutput.parse(mockOutput)).not.toThrow();
  });

  it("snapshot-load output matches schema", () => {
    const mockOutput = { loaded: "clean-state", emulatorId: "emulator-5554" };
    expect(() => EmulatorSnapshotLoadOutput.parse(mockOutput)).not.toThrow();
  });

  it("snapshot-list output matches schema", () => {
    const mockOutput = { snapshots: ["clean-state", "after-login"], emulatorId: "emulator-5554" };
    expect(() => EmulatorSnapshotListOutput.parse(mockOutput)).not.toThrow();
  });

  it("snapshot-delete output matches schema", () => {
    const mockOutput = { deleted: "clean-state", emulatorId: "emulator-5554" };
    expect(() => EmulatorSnapshotDeleteOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("gradle-build output schema validation", () => {
  it("build output matches schema", () => {
    const mockOutput = {
      buildId: "build-abc123-1234567890",
      summary: {
        success: true,
        duration: "45s",
        warnings: 2,
        errors: 0,
        apkPath: "app/build/outputs/apk/debug/app-debug.apk",
        tasksExecuted: 12,
      },
    };
    expect(() => GradleBuildOutput.parse(mockOutput)).not.toThrow();
  });

  it("failed build output matches schema", () => {
    const mockOutput = {
      buildId: "build-def456-1234567890",
      summary: {
        success: false,
        duration: "10s",
        warnings: 0,
        errors: 3,
      },
    };
    expect(() => GradleBuildOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("gradle-test output schema validation", () => {
  it("test run output matches schema", () => {
    const mockOutput = {
      testId: "test-abc123-1234567890",
      summary: {
        passed: 10,
        failed: 2,
        skipped: 1,
        total: 13,
        duration: "30s",
      },
      failures: [
        { test: "com.example.LoginTest.testLogin", message: "Expected true but was false" },
      ],
      regressions: [
        { test: "com.example.LoginTest.testLogin", previousStatus: "pass", currentStatus: "fail" },
      ],
    };
    expect(() => GradleTestRunOutput.parse(mockOutput)).not.toThrow();
  });

  it("test run output without regressions matches schema", () => {
    const mockOutput = {
      testId: "test-abc123-1234567890",
      summary: {
        passed: 10,
        failed: 0,
        skipped: 0,
        total: 10,
      },
      failures: [],
      regressions: [],
    };
    expect(() => GradleTestRunOutput.parse(mockOutput)).not.toThrow();
  });

  it("save baseline output matches schema", () => {
    const mockOutput = {
      testId: "test-abc123-1234567890",
      summary: {
        passed: 10,
        failed: 0,
        skipped: 0,
        total: 10,
      },
      baselineSaved: "unitTest",
      baselineTestCount: 10,
    };
    expect(() => GradleTestSaveBaselineOutput.parse(mockOutput)).not.toThrow();
  });

  it("clear baseline output matches schema", () => {
    const mockOutput = { baselineCleared: "unitTest" };
    expect(() => GradleTestClearBaselineOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("gradle-list output schema validation", () => {
  it("modules output matches schema", () => {
    const mockOutput = { modules: [":app", ":lib", ":core"] };
    expect(() => GradleListModulesOutput.parse(mockOutput)).not.toThrow();
  });

  it("variants output matches schema", () => {
    const mockOutput = {
      variants: [
        { name: "debug", buildType: "debug", flavors: [] },
        { name: "freeRelease", buildType: "release", flavors: ["free"] },
      ],
      module: "all",
    };
    expect(() => GradleListVariantsOutput.parse(mockOutput)).not.toThrow();
  });

  it("tasks output matches schema", () => {
    const mockOutput = {
      listId: "tasks-abc123-1234567890",
      summary: {
        totalTasks: 50,
        buildTasks: ["assembleDebug", "assembleRelease"],
        testTasks: ["testDebugUnitTest"],
        cleanTasks: ["clean"],
      },
      module: "all",
    };
    expect(() => GradleListTasksOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("gradle-get-details output schema validation", () => {
  it("logs detail output matches schema", () => {
    const mockOutput = {
      id: "build-abc123-1234567890",
      operation: "assembleDebug",
      logs: "> Task :app:compileDebugKotlin\nBUILD SUCCESSFUL in 45s",
    };
    expect(() => GradleGetDetailsLogsOutput.parse(mockOutput)).not.toThrow();
  });

  it("errors detail output matches schema", () => {
    const mockOutput = {
      id: "build-abc123-1234567890",
      operation: "assembleDebug",
      errors: "e: error: Unresolved reference: foo",
      errorCount: 1,
    };
    expect(() => GradleGetDetailsErrorsOutput.parse(mockOutput)).not.toThrow();
  });

  it("tasks detail output matches schema", () => {
    const mockOutput = {
      id: "build-abc123-1234567890",
      operation: "assembleDebug",
      tasks: [
        { task: ":app:compileDebugKotlin", status: "executed" },
        { task: ":app:mergeDebugResources", status: "UP-TO-DATE" },
      ],
    };
    expect(() => GradleGetDetailsTasksOutput.parse(mockOutput)).not.toThrow();
  });

  it("all detail output matches schema", () => {
    const mockOutput = {
      id: "build-abc123-1234567890",
      operation: "assembleDebug",
      result: { success: true, duration: "45s" },
      fullOutput: "> Task :app:compileDebugKotlin\nBUILD SUCCESSFUL in 45s",
    };
    expect(() => GradleGetDetailsAllOutput.parse(mockOutput)).not.toThrow();
  });
});

describe("ui output schema validation", () => {
  it("dump full output matches schema", () => {
    const mockOutput = {
      dumpId: "ui-dump-abc123-1234567890",
      tree: [
        {
          className: "FrameLayout",
          text: undefined,
          resourceId: undefined,
          bounds: "[0,0][1080,2340]",
          clickable: undefined,
          children: [
            {
              className: "TextView",
              text: "Hello",
              resourceId: "greeting",
              bounds: "[100,200][500,250]",
              clickable: undefined,
              children: undefined,
            },
          ],
        },
      ],
      deviceId: "emulator-5554",
    };
    expect(() => UiDumpFullOutput.parse(mockOutput)).not.toThrow();
  });

  it("dump compact output matches schema", () => {
    const mockOutput = {
      dumpId: "ui-dump-abc123-1234567890",
      elements: [
        { text: "Login", type: "Button", x: 540, y: 1800, resourceId: "login_btn" },
        { text: "Username", type: "EditText", x: 540, y: 1000 },
      ],
      count: 2,
      totalCount: 15,
      hasMore: true,
      offset: 0,
      limit: 20,
      deviceId: "emulator-5554",
      hint: "2 of 15 elements shown. Use 'ui find' for specific elements, or add offset: 2 for more.",
    };
    expect(() => UiDumpCompactOutput.parse(mockOutput)).not.toThrow();
  });

  it("find output matches schema", () => {
    const mockOutput = {
      elements: [
        {
          index: 0,
          text: "Login",
          resourceId: "login_btn",
          className: "android.widget.Button",
          centerX: 540,
          centerY: 1800,
          bounds: { left: 100, top: 1750, right: 980, bottom: 1850 },
          clickable: true,
        },
      ],
      count: 1,
      deviceId: "emulator-5554",
      tier: 1,
      confidence: "high" as const,
    };
    expect(() => UiFindOutput.parse(mockOutput)).not.toThrow();
  });

  it("tap output matches schema", () => {
    const mockOutput = {
      tapped: { x: 540, y: 1800, deviceSpace: false },
      deviceId: "emulator-5554",
    };
    expect(() => UiTapOutput.parse(mockOutput)).not.toThrow();
  });

  it("input output matches schema", () => {
    const mockOutput = { input: "hello@example.com", deviceId: "emulator-5554" };
    expect(() => UiInputOutput.parse(mockOutput)).not.toThrow();
  });

  it("scroll output matches schema", () => {
    const mockOutput = {
      scrolled: { direction: "down" as const, amount: 0.5 },
      deviceId: "emulator-5554",
    };
    expect(() => UiScrollOutput.parse(mockOutput)).not.toThrow();
  });

  it("dump with empty warning matches schema", () => {
    const mockOutput = {
      dumpId: "ui-dump-abc123-1234567890",
      tree: [],
      deviceId: "emulator-5554",
      warning: "No accessibility nodes found. Possible causes: (1) UI still loading - wait and retry, (2) App uses custom rendering (Flutter, games, video players) - use screenshot instead, (3) App blocks accessibility services.",
    };
    expect(() => UiDumpFullOutput.parse(mockOutput)).not.toThrow();
  });
});
