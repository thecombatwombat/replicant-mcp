# Just Works UX Design

**Date:** 2026-01-21
**Status:** Approved
**Goal:** Eliminate friction when using replicant-mcp tools by making environment detection, device selection, and screenshots work automatically.

## Problem Statement

Current pain points observed in real usage:

1. **"No device selected" error** - Tools fail with unhelpful error even when only one device is connected, requiring explicit `adb-device list` call first
2. **Screenshot silently fails** - `ui { operation: "screenshot" }` returns a path but no file is created (implementation is a stub)
3. **adb not in PATH** - Tools assume `adb` is in PATH; when it's not, errors are cryptic with no guidance
4. **Manual workarounds required** - Users end up running shell commands directly and hunting for SDK paths

## Design Overview

Five interconnected improvements:

1. **Environment Detection Service** - Auto-find Android SDK and tools
2. **Startup Health Check** - Validate environment on first use
3. **Auto Device Selection** - Single device = auto-select
4. **Screenshot Fix** - Actually implement the feature
5. **Actionable Error Messages** - Every error tells you how to fix it

## 1. Environment Detection Service

**New file:** `src/services/environment.ts`

### Interface

```typescript
interface Environment {
  sdkPath: string | null;
  adbPath: string | null;
  emulatorPath: string | null;
  platform: "darwin" | "linux" | "win32";
  isValid: boolean;
  issues: string[];
}

class EnvironmentService {
  private cached: Environment | null = null;

  async detect(): Promise<Environment>;
  getAdbPath(): string;  // throws if not found
  getEmulatorPath(): string;  // throws if not found
}
```

### Detection Flow

The service tries multiple strategies before failing:

```
1. Check ANDROID_HOME environment variable
   → validate: ${ANDROID_HOME}/platform-tools/adb exists?

2. Check ANDROID_SDK_ROOT environment variable
   → validate same way

3. Probe common SDK locations (platform-specific):

   macOS:
     ~/Library/Android/sdk
     /opt/homebrew/share/android-sdk
     /usr/local/share/android-sdk

   Linux:
     ~/Android/Sdk
     /opt/android-sdk
     /usr/lib/android-sdk

   Windows:
     %LOCALAPPDATA%\Android\Sdk
     C:\Android\sdk

4. Try `which adb` (unix) / `where adb` (windows)
   → if found, derive SDK path from it

5. Check Android Studio config for SDK path:
   macOS: ~/Library/Application Support/Google/AndroidStudio*/options/jdk.table.xml

6. All strategies exhausted → return isValid: false with detailed issues
```

### Caching

- Detection runs once per session (lazy, on first use)
- Result cached in memory
- No persistence across sessions (environment may change)

## 2. Startup Health Check

**Location:** `src/server.ts` (integrated into tool dispatch)

### When It Runs

- **Lazy:** First tool call triggers health check
- **Cached:** Subsequent calls skip if already healthy
- **Manual:** New operation `adb-device { operation: "health-check" }` forces re-check

### Validation Steps

```typescript
interface HealthCheck {
  healthy: boolean;
  environment: Environment;
  adbServerRunning: boolean;
  connectedDevices: number;
  warnings: string[];   // Non-fatal (e.g., "emulator binary not found")
  errors: string[];     // Fatal with fix instructions
}
```

1. **Environment valid?** - SDK and adb found
2. **adb version works?** - Binary is executable
3. **adb server responding?** - `adb devices` succeeds (starts server if needed)
4. **Devices connected?** - At least one device available (warning, not error)

### Failure Behavior

If `healthy: false`, tool calls return the health check result instead of proceeding:

```json
{
  "error": "ENVIRONMENT_NOT_READY",
  "healthCheck": {
    "healthy": false,
    "errors": [
      "Android SDK not found after checking 8 locations. Install Android Studio or set ANDROID_HOME=/path/to/sdk"
    ]
  }
}
```

## 3. Auto Device Selection

**Changes to:** `src/services/device-state.ts`

### New Method

Replace `requireCurrentDevice()` with `ensureDevice()`:

```typescript
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
  const deviceList = devices.map(d => d.id).join(", ");
  throw new ReplicantError(
    ErrorCode.MULTIPLE_DEVICES,
    `${devices.length} devices connected: ${deviceList}`,
    `Call adb-device({ operation: 'select', deviceId: '...' }) to choose one`
  );
}
```

### Tools Updated

All device-dependent tools call `ensureDevice()` instead of `requireCurrentDevice()`:

- `src/tools/ui.ts`
- `src/tools/adb-app.ts`
- `src/tools/adb-shell.ts`
- `src/tools/adb-logcat.ts`

## 4. Screenshot Fix

**Changes to:** `src/adapters/ui-automator.ts`, `src/adapters/adb.ts`, `src/tools/ui.ts`

### Current Problem

The existing implementation is a non-functional stub:

```typescript
// Current broken code
async screenshot(deviceId: string, localPath: string): Promise<void> {
  await this.adb.shell(deviceId, `screencap -p ${remotePath}`);
  const result = await this.adb.shell(deviceId, `base64 ${remotePath}`);  // Never saved!
  await this.adb.shell(deviceId, `rm ${remotePath}`);
  // localPath is completely ignored
}
```

### New Implementation

**Add `pull()` to AdbAdapter:**

```typescript
async pull(deviceId: string, remotePath: string, localPath: string): Promise<void> {
  const result = await this.runner.run(
    this.environment.getAdbPath(),
    ["-s", deviceId, "pull", remotePath, localPath]
  );
  if (result.exitCode !== 0) {
    throw new ReplicantError(
      ErrorCode.PULL_FAILED,
      `Failed to pull ${remotePath} to ${localPath}`,
      result.stderr || "Check device connection and paths"
    );
  }
}
```

**Rewrite screenshot():**

```typescript
interface ScreenshotResult {
  mode: "file" | "inline";
  path?: string;
  base64?: string;
  sizeBytes?: number;
}

async screenshot(deviceId: string, options: { localPath?: string; inline?: boolean }): Promise<ScreenshotResult> {
  const remotePath = "/sdcard/replicant-screenshot.png";

  // Capture
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
      const result = await this.adb.shell(deviceId, `base64 ${remotePath}`);
      const sizeResult = await this.adb.shell(deviceId, `stat -c%s ${remotePath}`);
      return {
        mode: "inline",
        base64: result.stdout.trim(),
        sizeBytes: parseInt(sizeResult.stdout.trim(), 10)
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
```

### Updated Tool Schema

```typescript
export const uiInputSchema = z.object({
  operation: z.enum(["dump", "find", "tap", "input", "screenshot", "accessibility-check"]),
  // ... existing fields ...
  localPath: z.string().optional(),   // Custom save path for screenshot
  inline: z.boolean().optional(),      // Return base64 instead of file (token-heavy)
});
```

### Response Examples

**Default (file mode):**
```json
{ "mode": "file", "path": "/tmp/replicant-screenshot-1705847293.png", "deviceId": "emulator-5554" }
```

**Inline mode:**
```json
{ "mode": "inline", "base64": "iVBORw0KGgo...", "sizeBytes": 2424657, "deviceId": "emulator-5554" }
```

## 5. Actionable Error Messages

**Changes to:** `src/types/errors.ts`

### Enhanced Error Codes

| Code | Message Template | Suggestion |
|------|------------------|------------|
| `SDK_NOT_FOUND` | "Android SDK not found after checking {n} locations" | "Install Android Studio or set ANDROID_HOME=/path/to/sdk" |
| `ADB_NOT_FOUND` | "adb binary not found" | "Verify Android SDK installation at {path}" |
| `ADB_NOT_EXECUTABLE` | "adb found but not executable at {path}" | "Check file permissions: chmod +x {path}" |
| `ADB_SERVER_ERROR` | "adb server not responding" | "Run 'adb kill-server && adb start-server'" |
| `NO_DEVICES` | "No devices connected" | "Start an emulator or connect a device via USB with debugging enabled" |
| `MULTIPLE_DEVICES` | "Multiple devices connected: {list}" | "Call adb-device select with one of: {ids}" |
| `DEVICE_OFFLINE` | "Device {id} is offline" | "Reconnect USB or restart emulator" |
| `SCREENSHOT_FAILED` | "Screenshot capture failed" | "Ensure device screen is on and unlocked" |
| `PULL_FAILED` | "Failed to pull {remote} to {local}" | "Check device connection and file paths" |

### Error Structure

```typescript
class ReplicantError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public suggestion: string,
    public context?: {
      command?: string;
      exitCode?: number;
      stderr?: string;
      checkedPaths?: string[];
    }
  ) {
    super(message);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      suggestion: this.suggestion,
      context: this.context
    };
  }
}
```

## Implementation Order

1. **Environment Service** - Foundation for everything else
2. **AdbAdapter.pull()** - Required for screenshot fix
3. **Screenshot fix** - High-visibility improvement
4. **Auto device selection** - Quality of life
5. **Health check** - Ties it all together
6. **Error message updates** - Polish throughout

## Testing Strategy

- Unit tests for environment detection with mocked filesystem
- Integration tests with real emulator for screenshot and device selection
- Error path tests verifying suggestions are helpful

## Non-Goals

- Auto-installing SDK components
- Persisting environment detection across sessions
- Supporting non-standard SDK layouts
