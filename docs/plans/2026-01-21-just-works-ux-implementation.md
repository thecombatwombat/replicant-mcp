# Just Works UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate friction when using replicant-mcp by making environment detection, device selection, and screenshots work automatically.

**Architecture:** Add an EnvironmentService that probes multiple locations for Android SDK on first use. Update DeviceStateManager with async `ensureDevice()` that auto-selects single devices. Fix screenshot to actually pull files from device. All errors include actionable fix suggestions.

**Tech Stack:** TypeScript, Node.js (execa for process execution), Vitest for testing

---

### Task 1: Add New Error Codes

**Files:**
- Modify: `src/types/errors.ts`
- Test: `tests/types/errors.test.ts` (create)

**Step 1: Write the failing test**

Create `tests/types/errors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ReplicantError, ErrorCode } from "../src/types/errors.js";

describe("ReplicantError", () => {
  it("includes suggestion in JSON output", () => {
    const error = new ReplicantError(
      ErrorCode.SDK_NOT_FOUND,
      "Android SDK not found",
      "Install Android Studio or set ANDROID_HOME"
    );

    const json = error.toJSON();

    expect(json.error).toBe("SDK_NOT_FOUND");
    expect(json.message).toBe("Android SDK not found");
    expect(json.suggestion).toBe("Install Android Studio or set ANDROID_HOME");
  });

  it("includes optional context in JSON output", () => {
    const error = new ReplicantError(
      ErrorCode.ADB_NOT_FOUND,
      "adb not found",
      "Check SDK installation",
      { checkedPaths: ["/usr/bin/adb", "/opt/android/adb"] }
    );

    const json = error.toJSON();

    expect(json.context?.checkedPaths).toEqual(["/usr/bin/adb", "/opt/android/adb"]);
  });
});

describe("ErrorCode", () => {
  it("has SDK_NOT_FOUND code", () => {
    expect(ErrorCode.SDK_NOT_FOUND).toBe("SDK_NOT_FOUND");
  });

  it("has ADB_NOT_FOUND code", () => {
    expect(ErrorCode.ADB_NOT_FOUND).toBe("ADB_NOT_FOUND");
  });

  it("has NO_DEVICES code", () => {
    expect(ErrorCode.NO_DEVICES).toBe("NO_DEVICES");
  });

  it("has MULTIPLE_DEVICES code", () => {
    expect(ErrorCode.MULTIPLE_DEVICES).toBe("MULTIPLE_DEVICES");
  });

  it("has SCREENSHOT_FAILED code", () => {
    expect(ErrorCode.SCREENSHOT_FAILED).toBe("SCREENSHOT_FAILED");
  });

  it("has PULL_FAILED code", () => {
    expect(ErrorCode.PULL_FAILED).toBe("PULL_FAILED");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/types/errors.test.ts`
Expected: FAIL - missing error codes and toJSON method

**Step 3: Write minimal implementation**

Update `src/types/errors.ts`:

```typescript
export enum ErrorCode {
  // Existing codes
  NO_DEVICE_SELECTED = "NO_DEVICE_SELECTED",
  INSTALL_FAILED = "INSTALL_FAILED",
  PACKAGE_NOT_FOUND = "PACKAGE_NOT_FOUND",
  COMMAND_BLOCKED = "COMMAND_BLOCKED",
  TIMEOUT = "TIMEOUT",
  EMULATOR_NOT_FOUND = "EMULATOR_NOT_FOUND",
  EMULATOR_START_FAILED = "EMULATOR_START_FAILED",
  AVD_NOT_FOUND = "AVD_NOT_FOUND",
  BUILD_FAILED = "BUILD_FAILED",

  // New codes for "Just Works" UX
  SDK_NOT_FOUND = "SDK_NOT_FOUND",
  ADB_NOT_FOUND = "ADB_NOT_FOUND",
  ADB_NOT_EXECUTABLE = "ADB_NOT_EXECUTABLE",
  ADB_SERVER_ERROR = "ADB_SERVER_ERROR",
  NO_DEVICES = "NO_DEVICES",
  MULTIPLE_DEVICES = "MULTIPLE_DEVICES",
  DEVICE_OFFLINE = "DEVICE_OFFLINE",
  SCREENSHOT_FAILED = "SCREENSHOT_FAILED",
  PULL_FAILED = "PULL_FAILED",
  HEALTH_CHECK_FAILED = "HEALTH_CHECK_FAILED",
}

export interface ErrorContext {
  command?: string;
  exitCode?: number;
  stderr?: string;
  checkedPaths?: string[];
}

export class ReplicantError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public suggestion: string,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = "ReplicantError";
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      suggestion: this.suggestion,
      context: this.context,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/types/errors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/errors.ts tests/types/errors.test.ts
git commit -m "feat(errors): add new error codes and toJSON method for actionable messages"
```

---

### Task 2: Create Environment Service

**Files:**
- Create: `src/services/environment.ts`
- Test: `tests/services/environment.test.ts`
- Modify: `src/services/index.ts` (add export)

**Step 1: Write the failing test**

Create `tests/services/environment.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EnvironmentService } from "../src/services/environment.js";
import * as fs from "fs";
import * as os from "os";

// Mock fs and os
vi.mock("fs");
vi.mock("os");

describe("EnvironmentService", () => {
  let service: EnvironmentService;

  beforeEach(() => {
    service = new EnvironmentService();
    vi.resetAllMocks();
    // Clear cached environment
    (service as any).cached = null;
  });

  afterEach(() => {
    // Restore env vars
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
  });

  describe("detect", () => {
    it("uses ANDROID_HOME when set and valid", async () => {
      process.env.ANDROID_HOME = "/opt/android-sdk";
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/opt/android-sdk/platform-tools/adb";
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe("/opt/android-sdk");
      expect(env.adbPath).toBe("/opt/android-sdk/platform-tools/adb");
      expect(env.isValid).toBe(true);
    });

    it("uses ANDROID_SDK_ROOT as fallback", async () => {
      process.env.ANDROID_SDK_ROOT = "/usr/local/android";
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/usr/local/android/platform-tools/adb";
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe("/usr/local/android");
      expect(env.isValid).toBe(true);
    });

    it("probes common macOS paths when env vars not set", async () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue("/Users/test");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/Users/test/Library/Android/sdk/platform-tools/adb";
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe("/Users/test/Library/Android/sdk");
      expect(env.isValid).toBe(true);
    });

    it("probes common Linux paths when env vars not set", async () => {
      vi.mocked(os.platform).mockReturnValue("linux");
      vi.mocked(os.homedir).mockReturnValue("/home/test");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/home/test/Android/Sdk/platform-tools/adb";
      });

      const env = await service.detect();

      expect(env.sdkPath).toBe("/home/test/Android/Sdk");
      expect(env.isValid).toBe(true);
    });

    it("returns invalid when SDK not found anywhere", async () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue("/Users/test");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const env = await service.detect();

      expect(env.isValid).toBe(false);
      expect(env.issues.length).toBeGreaterThan(0);
      expect(env.issues[0]).toContain("Android SDK not found");
    });

    it("caches result after first detection", async () => {
      process.env.ANDROID_HOME = "/opt/android-sdk";
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await service.detect();
      await service.detect();

      // existsSync should only be called during first detect
      expect(fs.existsSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAdbPath", () => {
    it("returns adb path when valid", async () => {
      process.env.ANDROID_HOME = "/opt/android-sdk";
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const adbPath = await service.getAdbPath();

      expect(adbPath).toBe("/opt/android-sdk/platform-tools/adb");
    });

    it("throws when SDK not found", async () => {
      vi.mocked(os.platform).mockReturnValue("darwin");
      vi.mocked(os.homedir).mockReturnValue("/Users/test");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(service.getAdbPath()).rejects.toThrow("Android SDK not found");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/environment.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/services/environment.ts`:

```typescript
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ReplicantError, ErrorCode } from "../types/index.js";

export interface Environment {
  sdkPath: string | null;
  adbPath: string | null;
  emulatorPath: string | null;
  platform: "darwin" | "linux" | "win32";
  isValid: boolean;
  issues: string[];
}

export class EnvironmentService {
  private cached: Environment | null = null;

  async detect(): Promise<Environment> {
    if (this.cached) {
      return this.cached;
    }

    const platform = os.platform() as "darwin" | "linux" | "win32";
    const issues: string[] = [];

    // Try to find SDK
    const sdkPath = this.findSdkPath(platform);

    if (!sdkPath) {
      this.cached = {
        sdkPath: null,
        adbPath: null,
        emulatorPath: null,
        platform,
        isValid: false,
        issues: ["Android SDK not found. Install Android Studio or set ANDROID_HOME environment variable."],
      };
      return this.cached;
    }

    const adbPath = path.join(sdkPath, "platform-tools", "adb");
    const emulatorPath = path.join(sdkPath, "emulator", "emulator");

    // Verify adb exists
    if (!fs.existsSync(adbPath)) {
      issues.push(`adb not found at ${adbPath}`);
    }

    // Emulator is optional - just note if missing
    if (!fs.existsSync(emulatorPath)) {
      issues.push(`emulator not found at ${emulatorPath} (optional)`);
    }

    this.cached = {
      sdkPath,
      adbPath: fs.existsSync(adbPath) ? adbPath : null,
      emulatorPath: fs.existsSync(emulatorPath) ? emulatorPath : null,
      platform,
      isValid: fs.existsSync(adbPath),
      issues,
    };

    return this.cached;
  }

  async getAdbPath(): Promise<string> {
    const env = await this.detect();
    if (!env.adbPath) {
      throw new ReplicantError(
        ErrorCode.ADB_NOT_FOUND,
        "Android SDK not found",
        "Install Android Studio or set ANDROID_HOME environment variable",
        { checkedPaths: this.getSearchPaths(env.platform) }
      );
    }
    return env.adbPath;
  }

  async getEmulatorPath(): Promise<string> {
    const env = await this.detect();
    if (!env.emulatorPath) {
      throw new ReplicantError(
        ErrorCode.EMULATOR_NOT_FOUND,
        "Android emulator not found",
        "Install Android Emulator via Android Studio SDK Manager"
      );
    }
    return env.emulatorPath;
  }

  private findSdkPath(platform: string): string | null {
    // 1. Check ANDROID_HOME
    if (process.env.ANDROID_HOME) {
      const adbPath = path.join(process.env.ANDROID_HOME, "platform-tools", "adb");
      if (fs.existsSync(adbPath)) {
        return process.env.ANDROID_HOME;
      }
    }

    // 2. Check ANDROID_SDK_ROOT
    if (process.env.ANDROID_SDK_ROOT) {
      const adbPath = path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb");
      if (fs.existsSync(adbPath)) {
        return process.env.ANDROID_SDK_ROOT;
      }
    }

    // 3. Probe common paths
    const searchPaths = this.getSearchPaths(platform);
    for (const sdkPath of searchPaths) {
      const adbPath = path.join(sdkPath, "platform-tools", "adb");
      if (fs.existsSync(adbPath)) {
        return sdkPath;
      }
    }

    return null;
  }

  private getSearchPaths(platform: string): string[] {
    const home = os.homedir();

    if (platform === "darwin") {
      return [
        path.join(home, "Library", "Android", "sdk"),
        "/opt/homebrew/share/android-sdk",
        "/usr/local/share/android-sdk",
      ];
    }

    if (platform === "linux") {
      return [
        path.join(home, "Android", "Sdk"),
        "/opt/android-sdk",
        "/usr/lib/android-sdk",
      ];
    }

    if (platform === "win32") {
      const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
      return [
        path.join(localAppData, "Android", "Sdk"),
        "C:\\Android\\sdk",
      ];
    }

    return [];
  }

  // Clear cache (for testing)
  clearCache(): void {
    this.cached = null;
  }
}
```

**Step 4: Add export to index**

Update `src/services/index.ts` to add:

```typescript
export { EnvironmentService, Environment } from "./environment.js";
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/services/environment.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/services/environment.ts src/services/index.ts tests/services/environment.test.ts
git commit -m "feat(environment): add EnvironmentService with SDK auto-detection"
```

---

### Task 3: Update ProcessRunner to Use Environment Service

**Files:**
- Modify: `src/services/process-runner.ts`
- Modify: `tests/services/process-runner.test.ts`

**Step 1: Write the failing test**

Add to `tests/services/process-runner.test.ts`:

```typescript
describe("ProcessRunner with EnvironmentService", () => {
  it("uses environment service to resolve adb path", async () => {
    const mockEnv = {
      getAdbPath: vi.fn().mockResolvedValue("/custom/path/adb"),
    };
    const runner = new ProcessRunner(mockEnv as any);

    // This will fail because adb doesn't exist at that path, but we're testing the path resolution
    try {
      await runner.runAdb(["version"]);
    } catch {
      // Expected to fail
    }

    expect(mockEnv.getAdbPath).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/process-runner.test.ts`
Expected: FAIL - runAdb method doesn't exist

**Step 3: Write minimal implementation**

Update `src/services/process-runner.ts`:

```typescript
import { execa } from "execa";
import { ReplicantError, ErrorCode } from "../types/index.js";
import { EnvironmentService } from "./environment.js";

export interface RunOptions {
  timeoutMs?: number;
  cwd?: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const BLOCKED_COMMANDS = new Set(["reboot", "shutdown", "halt", "poweroff"]);

const BLOCKED_PATTERNS = [
  /^rm\s+(-[rf]+\s+)*\//, // rm -rf /
  /^su(\s|$)/, // su
  /^sudo(\s|$)/, // sudo
  /\bformat\b/, // format commands
];

export class ProcessRunner {
  private readonly defaultTimeoutMs = 30_000;
  private readonly maxTimeoutMs = 120_000;

  constructor(private environment?: EnvironmentService) {}

  async run(
    command: string,
    args: string[],
    options: RunOptions = {}
  ): Promise<RunResult> {
    this.validateCommand(command, args);

    const timeoutMs = Math.min(
      options.timeoutMs ?? this.defaultTimeoutMs,
      this.maxTimeoutMs
    );

    try {
      const result = await execa(command, args, {
        timeout: timeoutMs,
        cwd: options.cwd,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 0,
      };
    } catch (error: unknown) {
      // Check for timeout (execa v9 uses timedOut property)
      if (
        typeof error === "object" &&
        error !== null &&
        "timedOut" in error &&
        (error as { timedOut: boolean }).timedOut
      ) {
        throw new ReplicantError(
          ErrorCode.TIMEOUT,
          `Command timed out after ${timeoutMs}ms`,
          "Try increasing the timeout or simplifying the command"
        );
      }
      // For non-zero exit code, return the result instead of throwing
      if (
        typeof error === "object" &&
        error !== null &&
        "exitCode" in error &&
        "stdout" in error &&
        "stderr" in error
      ) {
        const execaError = error as { exitCode: number; stdout: string; stderr: string };
        return {
          stdout: execaError.stdout,
          stderr: execaError.stderr,
          exitCode: execaError.exitCode,
        };
      }
      throw error;
    }
  }

  async runAdb(args: string[], options: RunOptions = {}): Promise<RunResult> {
    if (!this.environment) {
      // Fallback to bare "adb" if no environment service
      return this.run("adb", args, options);
    }

    const adbPath = await this.environment.getAdbPath();
    return this.run(adbPath, args, options);
  }

  private validateCommand(command: string, args: string[]): void {
    if (BLOCKED_COMMANDS.has(command)) {
      throw new ReplicantError(
        ErrorCode.COMMAND_BLOCKED,
        `Command '${command}' is not allowed`,
        "Use safe commands only"
      );
    }

    const fullCommand = `${command} ${args.join(" ")}`;
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(fullCommand)) {
        throw new ReplicantError(
          ErrorCode.COMMAND_BLOCKED,
          `Command '${fullCommand}' is not allowed`,
          "Use safe commands only"
        );
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/services/process-runner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/process-runner.ts tests/services/process-runner.test.ts
git commit -m "feat(process-runner): add runAdb method using EnvironmentService"
```

---

### Task 4: Add pull() Method to AdbAdapter

**Files:**
- Modify: `src/adapters/adb.ts`
- Modify: `tests/adapters/adb.test.ts`

**Step 1: Write the failing test**

Add to `tests/adapters/adb.test.ts`:

```typescript
describe("pull", () => {
  it("pulls file from device to local path", async () => {
    mockRunner.run.mockResolvedValue({ stdout: "1 file pulled", stderr: "", exitCode: 0 });

    await adapter.pull("emulator-5554", "/sdcard/test.png", "/tmp/test.png");

    expect(mockRunner.run).toHaveBeenCalledWith(
      "adb",
      ["-s", "emulator-5554", "pull", "/sdcard/test.png", "/tmp/test.png"],
      undefined
    );
  });

  it("throws PULL_FAILED on error", async () => {
    mockRunner.run.mockResolvedValue({ stdout: "", stderr: "error: device offline", exitCode: 1 });

    await expect(
      adapter.pull("emulator-5554", "/sdcard/test.png", "/tmp/test.png")
    ).rejects.toThrow("Failed to pull");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/adb.test.ts`
Expected: FAIL - pull method doesn't exist

**Step 3: Write minimal implementation**

Add to `src/adapters/adb.ts`:

```typescript
async pull(deviceId: string, remotePath: string, localPath: string): Promise<void> {
  const result = await this.adb(["-s", deviceId, "pull", remotePath, localPath]);
  if (result.exitCode !== 0) {
    throw new ReplicantError(
      ErrorCode.PULL_FAILED,
      `Failed to pull ${remotePath} to ${localPath}`,
      result.stderr || "Check device connection and file paths"
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/adapters/adb.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/adb.ts tests/adapters/adb.test.ts
git commit -m "feat(adb): add pull method for file transfer from device"
```

---

### Task 5: Fix Screenshot Implementation

**Files:**
- Modify: `src/adapters/ui-automator.ts`
- Modify: `tests/adapters/ui-automator.test.ts`
- Modify: `src/tools/ui.ts`

**Step 1: Write the failing test**

Add to `tests/adapters/ui-automator.test.ts`:

```typescript
describe("screenshot", () => {
  it("captures screenshot and pulls to local path (file mode)", async () => {
    mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    mockAdb.pull.mockResolvedValue(undefined);

    const result = await adapter.screenshot("emulator-5554", { localPath: "/tmp/test.png" });

    expect(mockAdb.shell).toHaveBeenCalledWith("emulator-5554", "screencap -p /sdcard/replicant-screenshot.png");
    expect(mockAdb.pull).toHaveBeenCalledWith("emulator-5554", "/sdcard/replicant-screenshot.png", "/tmp/test.png");
    expect(result.mode).toBe("file");
    expect(result.path).toBe("/tmp/test.png");
  });

  it("uses default path when localPath not provided", async () => {
    mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    mockAdb.pull.mockResolvedValue(undefined);

    const result = await adapter.screenshot("emulator-5554", {});

    expect(result.mode).toBe("file");
    expect(result.path).toMatch(/^\/tmp\/replicant-screenshot-\d+\.png$/);
  });

  it("returns base64 when inline mode requested", async () => {
    mockAdb.shell
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // screencap
      .mockResolvedValueOnce({ stdout: "iVBORw0KGgo=", stderr: "", exitCode: 0 }) // base64
      .mockResolvedValueOnce({ stdout: "12345", stderr: "", exitCode: 0 }) // stat
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm

    const result = await adapter.screenshot("emulator-5554", { inline: true });

    expect(result.mode).toBe("inline");
    expect(result.base64).toBe("iVBORw0KGgo=");
    expect(result.sizeBytes).toBe(12345);
  });

  it("throws SCREENSHOT_FAILED when capture fails", async () => {
    mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "error", exitCode: 1 });

    await expect(
      adapter.screenshot("emulator-5554", {})
    ).rejects.toThrow("Failed to capture screenshot");
  });

  it("cleans up remote file after pull", async () => {
    mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    mockAdb.pull.mockResolvedValue(undefined);

    await adapter.screenshot("emulator-5554", { localPath: "/tmp/test.png" });

    // Last shell call should be rm
    const rmCall = mockAdb.shell.mock.calls.find(call => call[1].includes("rm"));
    expect(rmCall).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/ui-automator.test.ts`
Expected: FAIL - screenshot signature changed

**Step 3: Write minimal implementation**

Update `src/adapters/ui-automator.ts`:

```typescript
import { AdbAdapter } from "./adb.js";
import { parseUiDump, findElements, flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";
import { ReplicantError, ErrorCode } from "../types/index.js";

export interface ScreenshotOptions {
  localPath?: string;
  inline?: boolean;
}

export interface ScreenshotResult {
  mode: "file" | "inline";
  path?: string;
  base64?: string;
  sizeBytes?: number;
}

export class UiAutomatorAdapter {
  constructor(private adb: AdbAdapter = new AdbAdapter()) {}

  async dump(deviceId: string): Promise<AccessibilityNode[]> {
    // Dump UI hierarchy to device
    await this.adb.shell(deviceId, "uiautomator dump /sdcard/ui-dump.xml");

    // Pull the dump
    const result = await this.adb.shell(deviceId, "cat /sdcard/ui-dump.xml");

    // Clean up
    await this.adb.shell(deviceId, "rm /sdcard/ui-dump.xml");

    return parseUiDump(result.stdout);
  }

  async find(
    deviceId: string,
    selector: {
      resourceId?: string;
      text?: string;
      textContains?: string;
      className?: string;
    }
  ): Promise<AccessibilityNode[]> {
    const tree = await this.dump(deviceId);
    return findElements(tree, selector);
  }

  async tap(deviceId: string, x: number, y: number): Promise<void> {
    await this.adb.shell(deviceId, `input tap ${x} ${y}`);
  }

  async tapElement(deviceId: string, element: AccessibilityNode): Promise<void> {
    await this.tap(deviceId, element.centerX, element.centerY);
  }

  async input(deviceId: string, text: string): Promise<void> {
    // Escape special characters for shell
    const escaped = text.replace(/(['"\\$`])/g, "\\$1").replace(/ /g, "%s");
    await this.adb.shell(deviceId, `input text "${escaped}"`);
  }

  async screenshot(deviceId: string, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const remotePath = "/sdcard/replicant-screenshot.png";

    // Capture screenshot on device
    const captureResult = await this.adb.shell(deviceId, `screencap -p ${remotePath}`);
    if (captureResult.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.SCREENSHOT_FAILED,
        "Failed to capture screenshot",
        captureResult.stderr || "Ensure device screen is on and unlocked"
      );
    }

    try {
      if (options.inline) {
        // Inline mode: return base64
        const base64Result = await this.adb.shell(deviceId, `base64 ${remotePath}`);
        const sizeResult = await this.adb.shell(deviceId, `stat -c%s ${remotePath}`);
        return {
          mode: "inline",
          base64: base64Result.stdout.trim(),
          sizeBytes: parseInt(sizeResult.stdout.trim(), 10),
        };
      } else {
        // File mode (default): pull to local
        const localPath = options.localPath || `/tmp/replicant-screenshot-${Date.now()}.png`;
        await this.adb.pull(deviceId, remotePath, localPath);
        return { mode: "file", path: localPath };
      }
    } finally {
      // Always clean up remote file
      await this.adb.shell(deviceId, `rm -f ${remotePath}`);
    }
  }

  async accessibilityCheck(deviceId: string): Promise<{
    hasAccessibleElements: boolean;
    clickableCount: number;
    textCount: number;
    totalElements: number;
  }> {
    const tree = await this.dump(deviceId);
    const flat = flattenTree(tree);

    const clickableCount = flat.filter((n) => n.clickable).length;
    const textCount = flat.filter((n) => n.text || n.contentDesc).length;

    return {
      hasAccessibleElements: textCount > 0,
      clickableCount,
      textCount,
      totalElements: flat.length,
    };
  }
}
```

**Step 4: Update ui.ts tool to use new signature**

Update `src/tools/ui.ts` screenshot handling:

```typescript
// Update schema to add inline option
export const uiInputSchema = z.object({
  operation: z.enum(["dump", "find", "tap", "input", "screenshot", "accessibility-check"]),
  selector: z.object({
    resourceId: z.string().optional(),
    text: z.string().optional(),
    textContains: z.string().optional(),
    className: z.string().optional(),
  }).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  elementIndex: z.number().optional(),
  text: z.string().optional(),
  localPath: z.string().optional(),
  inline: z.boolean().optional(),
});

// Update screenshot case in handleUiTool
case "screenshot": {
  const result = await context.ui.screenshot(deviceId, {
    localPath: input.localPath,
    inline: input.inline,
  });
  return { ...result, deviceId };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/adapters/ui-automator.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/adapters/ui-automator.ts src/tools/ui.ts tests/adapters/ui-automator.test.ts
git commit -m "fix(screenshot): implement working screenshot with file and inline modes"
```

---

### Task 6: Add ensureDevice Method to DeviceStateManager

**Files:**
- Modify: `src/services/device-state.ts`
- Modify: `tests/services/device-state.test.ts`

**Step 1: Write the failing test**

Add to `tests/services/device-state.test.ts`:

```typescript
describe("ensureDevice", () => {
  it("returns current device if already selected", async () => {
    const device = { id: "emulator-5554", type: "emulator" as const, name: "test", status: "online" as const };
    manager.setCurrentDevice(device);
    const mockAdb = { getDevices: vi.fn() };

    const result = await manager.ensureDevice(mockAdb as any);

    expect(result).toBe(device);
    expect(mockAdb.getDevices).not.toHaveBeenCalled();
  });

  it("auto-selects when exactly one device connected", async () => {
    const device = { id: "emulator-5554", type: "emulator" as const, name: "test", status: "online" as const };
    const mockAdb = { getDevices: vi.fn().mockResolvedValue([device]) };

    const result = await manager.ensureDevice(mockAdb as any);

    expect(result).toEqual(device);
    expect(manager.getCurrentDevice()).toEqual(device);
  });

  it("throws NO_DEVICES when no devices connected", async () => {
    const mockAdb = { getDevices: vi.fn().mockResolvedValue([]) };

    await expect(manager.ensureDevice(mockAdb as any)).rejects.toMatchObject({
      code: "NO_DEVICES",
      suggestion: expect.stringContaining("emulator"),
    });
  });

  it("throws MULTIPLE_DEVICES when multiple devices connected", async () => {
    const devices = [
      { id: "emulator-5554", type: "emulator" as const, name: "test1", status: "online" as const },
      { id: "device-1234", type: "physical" as const, name: "test2", status: "online" as const },
    ];
    const mockAdb = { getDevices: vi.fn().mockResolvedValue(devices) };

    await expect(manager.ensureDevice(mockAdb as any)).rejects.toMatchObject({
      code: "MULTIPLE_DEVICES",
      message: expect.stringContaining("emulator-5554"),
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/device-state.test.ts`
Expected: FAIL - ensureDevice doesn't exist

**Step 3: Write minimal implementation**

Update `src/services/device-state.ts`:

```typescript
import { Device, ReplicantError, ErrorCode } from "../types/index.js";
import { AdbAdapter } from "../adapters/adb.js";

export class DeviceStateManager {
  private currentDevice: Device | null = null;

  getCurrentDevice(): Device | null {
    return this.currentDevice;
  }

  setCurrentDevice(device: Device): void {
    this.currentDevice = device;
  }

  clearCurrentDevice(): void {
    this.currentDevice = null;
  }

  requireCurrentDevice(): Device {
    if (!this.currentDevice) {
      throw new ReplicantError(
        ErrorCode.NO_DEVICE_SELECTED,
        "No device selected",
        "Call adb-device({ operation: 'list' }) to see available devices"
      );
    }
    return this.currentDevice;
  }

  async ensureDevice(adb: AdbAdapter): Promise<Device> {
    // Already selected? Use it.
    if (this.currentDevice) {
      return this.currentDevice;
    }

    // Try to auto-select
    const devices = await adb.getDevices();

    if (devices.length === 0) {
      throw new ReplicantError(
        ErrorCode.NO_DEVICES,
        "No devices connected",
        "Start an emulator with 'emulator-device start' or connect a USB device with debugging enabled"
      );
    }

    if (devices.length === 1) {
      this.currentDevice = devices[0];
      return this.currentDevice;
    }

    // Multiple devices - user must choose
    const deviceList = devices.map((d) => d.id).join(", ");
    throw new ReplicantError(
      ErrorCode.MULTIPLE_DEVICES,
      `${devices.length} devices connected: ${deviceList}`,
      `Call adb-device({ operation: 'select', deviceId: '...' }) to choose one`
    );
  }

  autoSelectIfSingle(devices: Device[]): boolean {
    if (devices.length === 1 && !this.currentDevice) {
      this.currentDevice = devices[0];
      return true;
    }
    return false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/services/device-state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/device-state.ts tests/services/device-state.test.ts
git commit -m "feat(device-state): add ensureDevice for auto-selection of single device"
```

---

### Task 7: Update Tools to Use ensureDevice

**Files:**
- Modify: `src/tools/ui.ts`
- Modify: `src/tools/adb-app.ts`
- Modify: `src/tools/adb-shell.ts`
- Modify: `src/tools/adb-logcat.ts`

**Step 1: Update ui.ts**

Replace `requireCurrentDevice()` with `ensureDevice()`:

```typescript
export async function handleUiTool(
  input: UiInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;
  // ... rest unchanged
}
```

**Step 2: Update adb-app.ts**

Replace `requireCurrentDevice()` with `ensureDevice()`:

```typescript
export async function handleAdbAppTool(
  input: AdbAppInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;
  // ... rest unchanged
}
```

**Step 3: Update adb-shell.ts**

Replace `requireCurrentDevice()` with `ensureDevice()`:

```typescript
export async function handleAdbShellTool(
  input: AdbShellInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;
  // ... rest unchanged
}
```

**Step 4: Update adb-logcat.ts**

Replace `requireCurrentDevice()` with `ensureDevice()`:

```typescript
export async function handleAdbLogcatTool(
  input: AdbLogcatInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;
  // ... rest unchanged
}
```

**Step 5: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/tools/ui.ts src/tools/adb-app.ts src/tools/adb-shell.ts src/tools/adb-logcat.ts
git commit -m "refactor(tools): use ensureDevice for auto device selection"
```

---

### Task 8: Add Health Check Operation

**Files:**
- Modify: `src/tools/adb-device.ts`
- Modify: `tests/tools/adb-device.test.ts` (if exists, otherwise integration test)

**Step 1: Add health-check operation to schema**

Update `src/tools/adb-device.ts`:

```typescript
export const adbDeviceInputSchema = z.object({
  operation: z.enum(["list", "select", "wait", "properties", "health-check"]),
  deviceId: z.string().optional(),
});
```

**Step 2: Implement health-check handler**

Add case in `handleAdbDeviceTool`:

```typescript
case "health-check": {
  const env = await context.environment.detect();
  let adbServerRunning = false;
  let connectedDevices = 0;
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!env.isValid) {
    errors.push(...env.issues);
  } else {
    // Test adb server
    try {
      const devices = await context.adb.getDevices();
      adbServerRunning = true;
      connectedDevices = devices.length;

      if (devices.length === 0) {
        warnings.push("No devices connected. Start an emulator or connect a USB device.");
      }
    } catch (e) {
      errors.push("adb server not responding. Run 'adb kill-server && adb start-server'");
    }
  }

  return {
    healthy: errors.length === 0,
    environment: {
      sdkPath: env.sdkPath,
      adbPath: env.adbPath,
      platform: env.platform,
    },
    adbServerRunning,
    connectedDevices,
    warnings,
    errors,
  };
}
```

**Step 3: Run tests**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/tools/adb-device.ts
git commit -m "feat(adb-device): add health-check operation for environment validation"
```

---

### Task 9: Wire Up Environment Service in Server Context

**Files:**
- Modify: `src/server.ts`

**Step 1: Add EnvironmentService to ServerContext**

Update `src/server.ts`:

```typescript
import { EnvironmentService } from "./services/environment.js";

export interface ServerContext {
  adb: AdbAdapter;
  gradle: GradleAdapter;
  emulator: EmulatorAdapter;
  ui: UiAutomatorAdapter;
  cache: CacheManager;
  deviceState: DeviceStateManager;
  environment: EnvironmentService;  // Add this
}

// In server initialization
const environment = new EnvironmentService();
const context: ServerContext = {
  adb,
  gradle,
  emulator,
  ui,
  cache,
  deviceState,
  environment,  // Add this
};
```

**Step 2: Run all tests**

Run: `npm test`
Expected: PASS

**Step 3: Build and verify**

Run: `npm run build`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): wire EnvironmentService into ServerContext"
```

---

### Task 10: Final Integration Test

**Files:**
- Create: `tests/integration/just-works-ux.test.ts`

**Step 1: Write integration test**

Create `tests/integration/just-works-ux.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeviceStateManager } from "../../src/services/device-state.js";
import { EnvironmentService } from "../../src/services/environment.js";

describe("Just Works UX Integration", () => {
  describe("Auto device selection flow", () => {
    it("auto-selects single device without explicit list call", async () => {
      const manager = new DeviceStateManager();
      const mockAdb = {
        getDevices: vi.fn().mockResolvedValue([
          { id: "emulator-5554", type: "emulator", name: "test", status: "online" }
        ]),
      };

      // Simulating what ui dump would do
      const device = await manager.ensureDevice(mockAdb as any);

      expect(device.id).toBe("emulator-5554");
      expect(mockAdb.getDevices).toHaveBeenCalledTimes(1);

      // Second call should not re-query
      const device2 = await manager.ensureDevice(mockAdb as any);
      expect(device2.id).toBe("emulator-5554");
      expect(mockAdb.getDevices).toHaveBeenCalledTimes(1);
    });
  });

  describe("Environment detection flow", () => {
    it("caches detection results", async () => {
      const env = new EnvironmentService();
      // Force a specific result by setting env var
      process.env.ANDROID_HOME = "/fake/path";

      const result1 = await env.detect();
      const result2 = await env.detect();

      // Should return same cached object
      expect(result1).toBe(result2);

      delete process.env.ANDROID_HOME;
    });
  });
});
```

**Step 2: Run integration test**

Run: `npm test -- tests/integration/just-works-ux.test.ts`
Expected: PASS

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add tests/integration/just-works-ux.test.ts
git commit -m "test: add integration tests for Just Works UX"
```

---

### Task 11: Update Tool Descriptions

**Files:**
- Modify: `src/tools/ui.ts` (update description)

**Step 1: Update tool description**

Update `uiToolDefinition` in `src/tools/ui.ts`:

```typescript
export const uiToolDefinition = {
  name: "ui",
  description: "Interact with app UI via accessibility tree. Auto-selects device if only one connected. Operations: dump, find, tap, input, screenshot, accessibility-check.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["dump", "find", "tap", "input", "screenshot", "accessibility-check"],
      },
      selector: {
        type: "object",
        properties: {
          resourceId: { type: "string" },
          text: { type: "string" },
          textContains: { type: "string" },
          className: { type: "string" },
        },
        description: "Element selector (for find)",
      },
      x: { type: "number", description: "X coordinate (for tap)" },
      y: { type: "number", description: "Y coordinate (for tap)" },
      elementIndex: { type: "number", description: "Element index from last find (for tap)" },
      text: { type: "string", description: "Text to input" },
      localPath: { type: "string", description: "Local path for screenshot (default: /tmp/replicant-screenshot-{timestamp}.png)" },
      inline: { type: "boolean", description: "Return base64 instead of file path (token-heavy, use sparingly)" },
    },
    required: ["operation"],
  },
};
```

**Step 2: Commit**

```bash
git add src/tools/ui.ts
git commit -m "docs(ui): update tool description with auto-select and screenshot options"
```

---

### Task 12: Build and Final Verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (87+ tests)

**Step 2: Build**

Run: `npm run build`
Expected: No errors

**Step 3: Final commit if any uncommitted changes**

```bash
git status
# If clean, skip. Otherwise:
git add -A
git commit -m "chore: final cleanup"
```

---

## Summary

This plan implements the "Just Works" UX in 12 tasks:

1. **Error codes** - Foundation for actionable messages
2. **Environment service** - SDK auto-detection
3. **ProcessRunner update** - Use environment for adb path
4. **AdbAdapter.pull()** - File transfer from device
5. **Screenshot fix** - Actually working implementation
6. **ensureDevice()** - Auto device selection
7. **Tool updates** - Use ensureDevice everywhere
8. **Health check** - Manual environment validation
9. **Server wiring** - Connect all pieces
10. **Integration tests** - Verify end-to-end
11. **Doc updates** - Tool descriptions
12. **Final build** - Ship it
