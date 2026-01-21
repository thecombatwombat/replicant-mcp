# Android Dev Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Claude Code skill layer that exposes all MCP tools via CLI + shell scripts.

**Architecture:** New CLI entry point (`src/cli.ts`) reuses existing adapters/services. Shell scripts in `skills/android-dev/` call the CLI. Install script symlinks to `~/.claude/skills/`.

**Tech Stack:** TypeScript, Commander.js (CLI), Bash (skills)

---

## Task 1: Add Commander.js Dependency

**Files:**
- Modify: `package.json`

**Step 1: Add commander dependency**

Run:
```bash
npm install commander
```

**Step 2: Verify installation**

Run: `grep commander package.json`
Expected: `"commander": "^..."`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add commander.js for CLI"
```

---

## Task 2: Create CLI Entry Point

**Files:**
- Create: `src/cli.ts`
- Modify: `package.json` (add build output)

**Step 1: Write the CLI scaffold with help command**

Create `src/cli.ts`:
```typescript
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("replicant")
  .description("Android development CLI for Claude Code skills")
  .version("1.0.0");

// Subcommands will be added in subsequent tasks
program.parse();
```

**Step 2: Update package.json bin entry**

Add to package.json `"bin"` section:
```json
{
  "bin": {
    "replicant-mcp": "dist/index.js",
    "replicant": "dist/cli.js"
  }
}
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: `dist/cli.js` exists

Run: `node dist/cli.js --help`
Expected: Shows help with description "Android development CLI for Claude Code skills"

**Step 4: Commit**

```bash
git add src/cli.ts package.json
git commit -m "feat(cli): add CLI entry point scaffold"
```

---

## Task 3: Create Output Formatter Utility

**Files:**
- Create: `src/cli/formatter.ts`
- Create: `tests/cli/formatter.test.ts`

**Step 1: Write the failing test**

Create `tests/cli/formatter.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { formatBuildSuccess, formatBuildFailure, formatTestResults } from "../../src/cli/formatter.js";

describe("CLI Formatter", () => {
  describe("formatBuildSuccess", () => {
    it("formats successful build with APK path", () => {
      const result = formatBuildSuccess({
        duration: "34s",
        apkPath: "app/build/outputs/apk/debug/app-debug.apk",
        apkSize: "12.4 MB",
        warnings: 2,
        cacheId: "build-a1b2c3",
      });

      expect(result).toContain("✓ Build successful");
      expect(result).toContain("34s");
      expect(result).toContain("app-debug.apk");
      expect(result).toContain("12.4 MB");
      expect(result).toContain("Warnings: 2");
      expect(result).toContain("build-a1b2c3");
    });
  });

  describe("formatBuildFailure", () => {
    it("formats failed build with error and cache id", () => {
      const result = formatBuildFailure({
        duration: "12s",
        error: "Unresolved reference: userRepository",
        cacheId: "build-x1y2z3",
      });

      expect(result).toContain("✗ Build failed");
      expect(result).toContain("12s");
      expect(result).toContain("Unresolved reference");
      expect(result).toContain("build-x1y2z3");
    });
  });

  describe("formatTestResults", () => {
    it("formats test results with failures", () => {
      const result = formatTestResults({
        passed: 47,
        failed: 2,
        skipped: 0,
        duration: "18s",
        failures: [
          "LoginViewModelTest.testInvalidEmail",
          "LoginRepositoryTest.testNetworkError",
        ],
        cacheId: "test-d4e5f6",
      });

      expect(result).toContain("47 passed");
      expect(result).toContain("2 failed");
      expect(result).toContain("18s");
      expect(result).toContain("LoginViewModelTest");
      expect(result).toContain("test-d4e5f6");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/cli/formatter.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/cli/formatter.ts`:
```typescript
export interface BuildSuccessData {
  duration: string;
  apkPath?: string;
  apkSize?: string;
  warnings: number;
  cacheId: string;
}

export interface BuildFailureData {
  duration: string;
  error: string;
  cacheId: string;
}

export interface TestResultsData {
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  failures: string[];
  cacheId: string;
}

export function formatBuildSuccess(data: BuildSuccessData): string {
  const lines = [`✓ Build successful (${data.duration})`];

  if (data.apkPath) {
    const filename = data.apkPath.split("/").pop();
    lines.push(`  APK: ${filename}${data.apkSize ? ` (${data.apkSize})` : ""}`);
  }

  if (data.warnings > 0) {
    lines.push(`  Warnings: ${data.warnings}`);
  }

  lines.push(`  Cache ID: ${data.cacheId}`);

  return lines.join("\n");
}

export function formatBuildFailure(data: BuildFailureData): string {
  const lines = [
    `✗ Build failed (${data.duration})`,
    "",
    `  Error: ${data.error}`,
    "",
    `  Cache ID: ${data.cacheId}`,
    `  Run: replicant gradle details ${data.cacheId} --errors`,
  ];

  return lines.join("\n");
}

export function formatTestResults(data: TestResultsData): string {
  const status = data.failed === 0 ? "✓" : "✗";
  const lines = [
    `${status} ${data.passed} passed, ${data.failed} failed, ${data.skipped} skipped (${data.duration})`,
  ];

  if (data.failures.length > 0) {
    lines.push("");
    lines.push("Failed:");
    data.failures.forEach(f => lines.push(`  • ${f}`));
  }

  lines.push("");
  lines.push(`Cache ID: ${data.cacheId}`);

  return lines.join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/cli/formatter.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/cli/formatter.ts tests/cli/formatter.test.ts
git commit -m "feat(cli): add output formatter for token-efficient summaries"
```

---

## Task 4: Add More Formatters (UI, Logcat, Devices)

**Files:**
- Modify: `src/cli/formatter.ts`
- Modify: `tests/cli/formatter.test.ts`

**Step 1: Write failing tests for new formatters**

Add to `tests/cli/formatter.test.ts`:
```typescript
import { formatUiDump, formatLogcat, formatDeviceList } from "../../src/cli/formatter.js";

describe("formatUiDump", () => {
  it("formats UI tree with interactive elements", () => {
    const result = formatUiDump({
      screenName: "MainActivity",
      elements: [
        { index: 0, type: "TextView", text: "Welcome back" },
        { index: 1, type: "EditText", hint: "email input", focused: true },
        { index: 2, type: "EditText", hint: "password input" },
        { index: 3, type: "Button", text: "Login" },
      ],
    });

    expect(result).toContain("MainActivity");
    expect(result).toContain("[0] TextView");
    expect(result).toContain("Welcome back");
    expect(result).toContain("[3] Button");
    expect(result).toContain("Login");
    expect(result).toContain("4 interactive elements");
  });
});

describe("formatLogcat", () => {
  it("formats error logs with count", () => {
    const result = formatLogcat({
      level: "error",
      count: 3,
      lines: [
        "E/ProfileActivity: NullPointerException at onCreate:47",
        "E/NetworkClient: Connection timeout after 30s",
        "E/CrashHandler: Fatal exception in main thread",
      ],
      cacheId: "logs-g7h8i9",
    });

    expect(result).toContain("3 errors");
    expect(result).toContain("NullPointerException");
    expect(result).toContain("logs-g7h8i9");
  });
});

describe("formatDeviceList", () => {
  it("formats device list with selection indicator", () => {
    const result = formatDeviceList({
      devices: [
        { id: "emulator-5554", name: "Pixel_7_API_34", state: "device", selected: true },
        { id: "abc123", name: "Physical Device", state: "device", selected: false },
      ],
    });

    expect(result).toContain("emulator-5554");
    expect(result).toContain("→"); // selection indicator
    expect(result).toContain("abc123");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/cli/formatter.test.ts`
Expected: FAIL - functions not exported

**Step 3: Add implementations**

Add to `src/cli/formatter.ts`:
```typescript
export interface UiElement {
  index: number;
  type: string;
  text?: string;
  hint?: string;
  focused?: boolean;
}

export interface UiDumpData {
  screenName: string;
  elements: UiElement[];
}

export interface LogcatData {
  level: string;
  count: number;
  lines: string[];
  cacheId: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  state: string;
  selected: boolean;
}

export interface DeviceListData {
  devices: DeviceInfo[];
}

export function formatUiDump(data: UiDumpData): string {
  const lines = [`Screen: ${data.screenName}`];

  data.elements.forEach((el, i) => {
    const prefix = i === data.elements.length - 1 ? "└─" : "├─";
    let desc = el.text || el.hint || "";
    if (el.focused) desc += " (focused)";
    lines.push(`${prefix} [${el.index}] ${el.type}${desc ? ` "${desc}"` : ""}`);
  });

  lines.push("");
  lines.push(`${data.elements.length} interactive elements`);

  return lines.join("\n");
}

export function formatLogcat(data: LogcatData): string {
  const lines = [`${data.count} ${data.level}s in recent logs:`, ""];

  data.lines.forEach(line => lines.push(line));

  lines.push("");
  lines.push(`Cache ID: ${data.cacheId}`);

  return lines.join("\n");
}

export function formatDeviceList(data: DeviceListData): string {
  if (data.devices.length === 0) {
    return "No devices connected";
  }

  const lines = ["Devices:"];

  data.devices.forEach(device => {
    const indicator = device.selected ? "→ " : "  ";
    lines.push(`${indicator}${device.id} (${device.name}) [${device.state}]`);
  });

  return lines.join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/cli/formatter.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/cli/formatter.ts tests/cli/formatter.test.ts
git commit -m "feat(cli): add UI, logcat, and device list formatters"
```

---

## Task 5: Create Gradle CLI Commands

**Files:**
- Create: `src/cli/gradle.ts`
- Modify: `src/cli.ts`

**Step 1: Create gradle subcommand module**

Create `src/cli/gradle.ts`:
```typescript
import { Command } from "commander";
import { GradleAdapter } from "../adapters/index.js";
import { CacheManager } from "../services/index.js";
import { formatBuildSuccess, formatBuildFailure, formatTestResults } from "./formatter.js";
import { CACHE_TTLS } from "../types/index.js";

export function createGradleCommand(): Command {
  const gradle = new Command("gradle")
    .description("Build and test Android apps");

  const adapter = new GradleAdapter();
  const cache = new CacheManager();

  gradle
    .command("build <operation>")
    .description("Build APK/bundle (assembleDebug, assembleRelease, bundle)")
    .option("-m, --module <module>", "Module path (e.g., :app)")
    .option("-f, --flavor <flavor>", "Product flavor")
    .option("--json", "Output as JSON")
    .action(async (operation: string, options) => {
      try {
        const { result, fullOutput } = await adapter.build(
          operation as "assembleDebug" | "assembleRelease" | "bundle",
          options.module,
          options.flavor
        );

        const cacheId = cache.generateId("build");
        cache.set(cacheId, { fullOutput, result, operation }, "build", CACHE_TTLS.BUILD_OUTPUT);

        if (options.json) {
          console.log(JSON.stringify({ cacheId, ...result }, null, 2));
        } else if (result.success) {
          console.log(formatBuildSuccess({
            duration: result.duration,
            apkPath: result.apkPath,
            warnings: result.warnings,
            cacheId,
          }));
        } else {
          console.log(formatBuildFailure({
            duration: result.duration,
            error: result.errors[0] || "Unknown error",
            cacheId,
          }));
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  gradle
    .command("test")
    .description("Run unit or instrumented tests")
    .option("-m, --module <module>", "Module path")
    .option("-t, --type <type>", "Test type (unit, instrumented)", "unit")
    .option("-c, --class <class>", "Test class filter")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const { result, fullOutput } = await adapter.test(
          options.type as "unit" | "instrumented",
          options.module,
          options.class
        );

        const cacheId = cache.generateId("test");
        cache.set(cacheId, { fullOutput, result }, "test", CACHE_TTLS.TEST_OUTPUT);

        if (options.json) {
          console.log(JSON.stringify({ cacheId, ...result }, null, 2));
        } else {
          console.log(formatTestResults({
            passed: result.passed,
            failed: result.failed,
            skipped: result.skipped,
            duration: result.duration,
            failures: result.failures.map(f => f.name),
            cacheId,
          }));
          if (result.failed > 0) process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  gradle
    .command("list <what>")
    .description("List modules, variants, or tasks")
    .option("--json", "Output as JSON")
    .action(async (what: string, options) => {
      try {
        const result = await adapter.list(what as "modules" | "variants" | "tasks");

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result.join("\n"));
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  gradle
    .command("details <cacheId>")
    .description("Get full output from cached build/test")
    .option("--errors", "Show only errors")
    .option("--full", "Show complete output")
    .action(async (cacheId: string, options) => {
      const entry = cache.get(cacheId);
      if (!entry) {
        console.error(`Cache entry not found: ${cacheId}`);
        process.exit(1);
      }

      if (options.errors && entry.data.result?.errors) {
        console.log(entry.data.result.errors.join("\n"));
      } else if (options.full) {
        console.log(entry.data.fullOutput);
      } else {
        console.log(entry.data.fullOutput);
      }
    });

  return gradle;
}
```

**Step 2: Wire up to main CLI**

Update `src/cli.ts`:
```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { createGradleCommand } from "./cli/gradle.js";

const program = new Command();

program
  .name("replicant")
  .description("Android development CLI for Claude Code skills")
  .version("1.0.0");

program.addCommand(createGradleCommand());

program.parse();
```

**Step 3: Build and verify**

Run: `npm run build`
Run: `node dist/cli.js gradle --help`
Expected: Shows gradle subcommands (build, test, list, details)

Run: `node dist/cli.js gradle build --help`
Expected: Shows build options (--module, --flavor, --json)

**Step 4: Commit**

```bash
git add src/cli.ts src/cli/gradle.ts
git commit -m "feat(cli): add gradle commands (build, test, list, details)"
```

---

## Task 6: Create ADB CLI Commands

**Files:**
- Create: `src/cli/adb.ts`
- Modify: `src/cli.ts`

**Step 1: Create adb subcommand module**

Create `src/cli/adb.ts`:
```typescript
import { Command } from "commander";
import { AdbAdapter } from "../adapters/index.js";
import { DeviceStateManager, CacheManager } from "../services/index.js";
import { formatDeviceList, formatLogcat } from "./formatter.js";
import { CACHE_TTLS } from "../types/index.js";

export function createAdbCommand(): Command {
  const adb = new Command("adb")
    .description("Device and app control");

  const adapter = new AdbAdapter();
  const deviceState = new DeviceStateManager();
  const cache = new CacheManager();

  adb
    .command("devices")
    .description("List connected devices")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const devices = await adapter.getDevices();
        const currentId = deviceState.getCurrentDevice()?.id;

        if (options.json) {
          console.log(JSON.stringify({ devices, selected: currentId }, null, 2));
        } else {
          console.log(formatDeviceList({
            devices: devices.map(d => ({
              id: d.id,
              name: d.model || d.id,
              state: d.state,
              selected: d.id === currentId,
            })),
          }));
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  adb
    .command("select <deviceId>")
    .description("Set active device for subsequent commands")
    .action(async (deviceId: string) => {
      try {
        const devices = await adapter.getDevices();
        const device = devices.find(d => d.id === deviceId);
        if (!device) {
          console.error(`Device not found: ${deviceId}`);
          process.exit(1);
        }
        deviceState.setCurrentDevice(device);
        console.log(`✓ Selected device: ${deviceId}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  adb
    .command("install <apkPath>")
    .description("Install APK to active device")
    .action(async (apkPath: string) => {
      try {
        const device = deviceState.requireCurrentDevice();
        await adapter.install(device.id, apkPath);
        console.log(`✓ Installed ${apkPath.split("/").pop()} to ${device.id}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  adb
    .command("launch <package>")
    .description("Launch app on active device")
    .action(async (packageName: string) => {
      try {
        const device = deviceState.requireCurrentDevice();
        await adapter.launch(device.id, packageName);
        console.log(`✓ Launched ${packageName}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  adb
    .command("stop <package>")
    .description("Force stop app")
    .action(async (packageName: string) => {
      try {
        const device = deviceState.requireCurrentDevice();
        await adapter.stop(device.id, packageName);
        console.log(`✓ Stopped ${packageName}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  adb
    .command("uninstall <package>")
    .description("Uninstall app from device")
    .action(async (packageName: string) => {
      try {
        const device = deviceState.requireCurrentDevice();
        await adapter.uninstall(device.id, packageName);
        console.log(`✓ Uninstalled ${packageName}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  adb
    .command("clear <package>")
    .description("Clear app data")
    .action(async (packageName: string) => {
      try {
        const device = deviceState.requireCurrentDevice();
        await adapter.clearData(device.id, packageName);
        console.log(`✓ Cleared data for ${packageName}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  adb
    .command("logcat")
    .description("Read device logs")
    .option("-l, --level <level>", "Filter by level (error, warn, info)")
    .option("-n, --lines <n>", "Number of lines", "50")
    .option("-t, --tag <tag>", "Filter by tag")
    .option("-p, --package <package>", "Filter by package")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const device = deviceState.requireCurrentDevice();

        let filter = "";
        if (options.level) {
          const levelMap: Record<string, string> = {
            error: "*:E",
            warn: "*:W",
            info: "*:I",
          };
          filter = levelMap[options.level] || "*:I";
        }
        if (options.tag) {
          filter = `${options.tag}:* *:S`;
        }

        const output = await adapter.logcat(device.id, {
          lines: parseInt(options.lines),
          filter,
        });

        const lines = output.trim().split("\n").filter(Boolean);
        const cacheId = cache.generateId("logs");
        cache.set(cacheId, { output, options }, "logs", CACHE_TTLS.LOG_OUTPUT);

        if (options.json) {
          console.log(JSON.stringify({ lines, cacheId }, null, 2));
        } else {
          console.log(formatLogcat({
            level: options.level || "info",
            count: lines.length,
            lines: lines.slice(0, 10), // Show first 10
            cacheId,
          }));
          if (lines.length > 10) {
            console.log(`\n... and ${lines.length - 10} more. Use 'replicant cache get ${cacheId}' for full output.`);
          }
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  adb
    .command("shell <command>")
    .description("Run shell command on device")
    .action(async (command: string) => {
      try {
        const device = deviceState.requireCurrentDevice();
        const result = await adapter.shell(device.id, command);
        console.log(result.stdout);
        if (result.exitCode !== 0) process.exit(result.exitCode);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  return adb;
}
```

**Step 2: Wire up to main CLI**

Update `src/cli.ts` imports and add command:
```typescript
import { createAdbCommand } from "./cli/adb.js";
// ... in program setup:
program.addCommand(createAdbCommand());
```

**Step 3: Build and verify**

Run: `npm run build`
Run: `node dist/cli.js adb --help`
Expected: Shows adb subcommands

**Step 4: Commit**

```bash
git add src/cli/adb.ts src/cli.ts
git commit -m "feat(cli): add adb commands (devices, install, launch, logcat, shell)"
```

---

## Task 7: Create Emulator CLI Commands

**Files:**
- Create: `src/cli/emulator.ts`
- Modify: `src/cli.ts`

**Step 1: Create emulator subcommand module**

Create `src/cli/emulator.ts`:
```typescript
import { Command } from "commander";
import { EmulatorAdapter } from "../adapters/index.js";

export function createEmulatorCommand(): Command {
  const emulator = new Command("emulator")
    .description("Manage Android emulators");

  const adapter = new EmulatorAdapter();

  emulator
    .command("list")
    .description("List available AVDs")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const { avds, running } = await adapter.list();

        if (options.json) {
          console.log(JSON.stringify({ avds, running }, null, 2));
        } else {
          console.log("Available AVDs:");
          avds.forEach(avd => {
            const isRunning = running.some(r => r.avdName === avd.name);
            const status = isRunning ? " (running)" : "";
            console.log(`  ${avd.name}${status}`);
          });
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  emulator
    .command("start <avdName>")
    .description("Start an emulator")
    .option("-c, --cold-boot", "Cold boot (no snapshot)")
    .option("-w, --wipe-data", "Wipe user data")
    .action(async (avdName: string, options) => {
      try {
        console.log(`Starting ${avdName}...`);
        const deviceId = await adapter.start(avdName, {
          coldBoot: options.coldBoot,
          wipeData: options.wipeData,
        });
        console.log(`✓ Emulator started: ${deviceId}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  emulator
    .command("stop <deviceId>")
    .description("Stop a running emulator")
    .action(async (deviceId: string) => {
      try {
        await adapter.stop(deviceId);
        console.log(`✓ Stopped ${deviceId}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  emulator
    .command("snapshot <action>")
    .description("Manage snapshots (save, load, list, delete)")
    .requiredOption("-d, --device <deviceId>", "Device ID")
    .option("-n, --name <name>", "Snapshot name")
    .action(async (action: string, options) => {
      try {
        switch (action) {
          case "save":
            if (!options.name) {
              console.error("Snapshot name required for save");
              process.exit(1);
            }
            await adapter.saveSnapshot(options.device, options.name);
            console.log(`✓ Saved snapshot: ${options.name}`);
            break;
          case "load":
            if (!options.name) {
              console.error("Snapshot name required for load");
              process.exit(1);
            }
            await adapter.loadSnapshot(options.device, options.name);
            console.log(`✓ Loaded snapshot: ${options.name}`);
            break;
          case "list":
            const snapshots = await adapter.listSnapshots(options.device);
            console.log("Snapshots:");
            snapshots.forEach(s => console.log(`  ${s}`));
            break;
          case "delete":
            if (!options.name) {
              console.error("Snapshot name required for delete");
              process.exit(1);
            }
            await adapter.deleteSnapshot(options.device, options.name);
            console.log(`✓ Deleted snapshot: ${options.name}`);
            break;
          default:
            console.error(`Unknown action: ${action}`);
            process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  return emulator;
}
```

**Step 2: Wire up to main CLI**

Update `src/cli.ts`:
```typescript
import { createEmulatorCommand } from "./cli/emulator.js";
// ... in program setup:
program.addCommand(createEmulatorCommand());
```

**Step 3: Build and verify**

Run: `npm run build`
Run: `node dist/cli.js emulator --help`
Expected: Shows emulator subcommands

**Step 4: Commit**

```bash
git add src/cli/emulator.ts src/cli.ts
git commit -m "feat(cli): add emulator commands (list, start, stop, snapshot)"
```

---

## Task 8: Create UI CLI Commands

**Files:**
- Create: `src/cli/ui.ts`
- Modify: `src/cli.ts`

**Step 1: Create ui subcommand module**

Create `src/cli/ui.ts`:
```typescript
import { Command } from "commander";
import { UiAutomatorAdapter } from "../adapters/index.js";
import { DeviceStateManager, CacheManager } from "../services/index.js";
import { formatUiDump } from "./formatter.js";
import { CACHE_TTLS } from "../types/index.js";
import { AccessibilityNode } from "../parsers/ui-dump.js";

// Store last find results
let lastFindResults: AccessibilityNode[] = [];

export function createUiCommand(): Command {
  const ui = new Command("ui")
    .description("UI automation via accessibility tree");

  const adapter = new UiAutomatorAdapter();
  const deviceState = new DeviceStateManager();
  const cache = new CacheManager();

  ui
    .command("dump")
    .description("Dump accessibility tree")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const device = deviceState.requireCurrentDevice();
        const tree = await adapter.dump(device.id);

        const cacheId = cache.generateId("ui-dump");
        cache.set(cacheId, { tree }, "ui-dump", CACHE_TTLS.UI_TREE);

        if (options.json) {
          console.log(JSON.stringify({ tree, cacheId }, null, 2));
        } else {
          // Extract interactive elements for summary
          const elements: Array<{ index: number; type: string; text?: string; hint?: string; focused?: boolean }> = [];
          let index = 0;

          const traverse = (node: AccessibilityNode) => {
            if (node.clickable || node.focusable || node.className.includes("EditText") || node.className.includes("Button")) {
              elements.push({
                index: index++,
                type: node.className.split(".").pop() || node.className,
                text: node.text || undefined,
                focused: node.focused,
              });
            }
            node.children?.forEach(traverse);
          };
          tree.forEach(traverse);

          console.log(formatUiDump({
            screenName: "Current Screen",
            elements,
          }));
          console.log(`\nCache ID: ${cacheId}`);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  ui
    .command("find")
    .description("Find UI elements")
    .option("--text <text>", "Find by exact text")
    .option("--contains <text>", "Find by text contains")
    .option("--id <resourceId>", "Find by resource ID")
    .option("--class <className>", "Find by class name")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const device = deviceState.requireCurrentDevice();
        const selector: Record<string, string> = {};

        if (options.text) selector.text = options.text;
        if (options.contains) selector.textContains = options.contains;
        if (options.id) selector.resourceId = options.id;
        if (options.class) selector.className = options.class;

        if (Object.keys(selector).length === 0) {
          console.error("At least one selector required (--text, --contains, --id, --class)");
          process.exit(1);
        }

        const elements = await adapter.find(device.id, selector);
        lastFindResults = elements;

        if (options.json) {
          console.log(JSON.stringify({ elements, count: elements.length }, null, 2));
        } else {
          if (elements.length === 0) {
            console.log("No elements found");
          } else {
            console.log(`Found ${elements.length} element(s):\n`);
            elements.forEach((el, i) => {
              console.log(`[${i}] ${el.className.split(".").pop()}`);
              if (el.text) console.log(`    text: "${el.text}"`);
              if (el.resourceId) console.log(`    id: ${el.resourceId}`);
              console.log(`    center: (${el.centerX}, ${el.centerY})`);
              console.log("");
            });
          }
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  ui
    .command("tap")
    .description("Tap an element")
    .option("-i, --index <index>", "Element index from last find")
    .option("-x <x>", "X coordinate")
    .option("-y <y>", "Y coordinate")
    .action(async (options) => {
      try {
        const device = deviceState.requireCurrentDevice();
        let x: number, y: number;

        if (options.index !== undefined) {
          const idx = parseInt(options.index);
          if (!lastFindResults[idx]) {
            console.error(`Element at index ${idx} not found. Run 'ui find' first.`);
            process.exit(1);
          }
          x = lastFindResults[idx].centerX;
          y = lastFindResults[idx].centerY;
        } else if (options.x && options.y) {
          x = parseInt(options.x);
          y = parseInt(options.y);
        } else {
          console.error("Either --index or --x/--y required");
          process.exit(1);
        }

        await adapter.tap(device.id, x, y);
        console.log(`✓ Tapped at (${x}, ${y})`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  ui
    .command("input <text>")
    .description("Input text to focused element")
    .action(async (text: string) => {
      try {
        const device = deviceState.requireCurrentDevice();
        await adapter.input(device.id, text);
        console.log(`✓ Input: "${text}"`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  ui
    .command("screenshot [path]")
    .description("Take screenshot")
    .action(async (path?: string) => {
      try {
        const device = deviceState.requireCurrentDevice();
        const outputPath = path || `/tmp/screenshot-${Date.now()}.png`;
        await adapter.screenshot(device.id, outputPath);
        console.log(`✓ Screenshot saved: ${outputPath}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  return ui;
}
```

**Step 2: Wire up to main CLI**

Update `src/cli.ts`:
```typescript
import { createUiCommand } from "./cli/ui.js";
// ... in program setup:
program.addCommand(createUiCommand());
```

**Step 3: Build and verify**

Run: `npm run build`
Run: `node dist/cli.js ui --help`
Expected: Shows ui subcommands

**Step 4: Commit**

```bash
git add src/cli/ui.ts src/cli.ts
git commit -m "feat(cli): add UI commands (dump, find, tap, input, screenshot)"
```

---

## Task 9: Create Cache CLI Commands

**Files:**
- Create: `src/cli/cache.ts`
- Modify: `src/cli.ts`

**Step 1: Create cache subcommand module**

Create `src/cli/cache.ts`:
```typescript
import { Command } from "commander";
import { CacheManager } from "../services/index.js";

export function createCacheCommand(): Command {
  const cacheCmd = new Command("cache")
    .description("Manage output cache");

  const cache = new CacheManager();

  cacheCmd
    .command("stats")
    .description("Show cache statistics")
    .option("--json", "Output as JSON")
    .action((options) => {
      const stats = cache.getStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log("Cache Statistics:");
        console.log(`  Entries: ${stats.entries}`);
        console.log(`  Size: ${stats.size}`);
        console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      }
    });

  cacheCmd
    .command("get <cacheId>")
    .description("Get cached entry")
    .action((cacheId: string) => {
      const entry = cache.get(cacheId);
      if (!entry) {
        console.error(`Not found: ${cacheId}`);
        process.exit(1);
      }
      console.log(JSON.stringify(entry.data, null, 2));
    });

  cacheCmd
    .command("clear")
    .description("Clear all cached data")
    .action(() => {
      cache.clear();
      console.log("✓ Cache cleared");
    });

  return cacheCmd;
}
```

**Step 2: Wire up to main CLI**

Update `src/cli.ts`:
```typescript
import { createCacheCommand } from "./cli/cache.ts";
// ... in program setup:
program.addCommand(createCacheCommand());
```

**Step 3: Build and verify**

Run: `npm run build`
Run: `node dist/cli.js cache --help`
Expected: Shows cache subcommands

**Step 4: Commit**

```bash
git add src/cli/cache.ts src/cli.ts
git commit -m "feat(cli): add cache commands (stats, get, clear)"
```

---

## Task 10: Create CLI Index Export

**Files:**
- Create: `src/cli/index.ts`

**Step 1: Create index file for clean imports**

Create `src/cli/index.ts`:
```typescript
export { createGradleCommand } from "./gradle.js";
export { createAdbCommand } from "./adb.js";
export { createEmulatorCommand } from "./emulator.js";
export { createUiCommand } from "./ui.js";
export { createCacheCommand } from "./cache.js";
export * from "./formatter.js";
```

**Step 2: Update main CLI to use index**

Update `src/cli.ts`:
```typescript
#!/usr/bin/env node
import { Command } from "commander";
import {
  createGradleCommand,
  createAdbCommand,
  createEmulatorCommand,
  createUiCommand,
  createCacheCommand,
} from "./cli/index.js";

const program = new Command();

program
  .name("replicant")
  .description("Android development CLI for Claude Code skills")
  .version("1.0.0");

program.addCommand(createGradleCommand());
program.addCommand(createAdbCommand());
program.addCommand(createEmulatorCommand());
program.addCommand(createUiCommand());
program.addCommand(createCacheCommand());

program.parse();
```

**Step 3: Build and verify all commands**

Run: `npm run build`
Run: `node dist/cli.js --help`
Expected: Shows all 5 command groups

**Step 4: Commit**

```bash
git add src/cli/index.ts src/cli.ts
git commit -m "refactor(cli): organize CLI modules with index exports"
```

---

## Task 11: Create SKILL.md Manifest

**Files:**
- Create: `skills/android-dev/SKILL.md`

**Step 1: Create skill manifest**

Create `skills/android-dev/SKILL.md`:
```markdown
# Android Development Skill

Automate Android development tasks: build APKs, run tests, manage emulators,
install apps, read logs, and interact with UI elements.

## When to Use

Use this skill when the user asks to:
- Build, compile, or assemble an Android app
- Run unit tests or instrumented tests
- Start, stop, or manage Android emulators
- Install, launch, or uninstall apps on a device
- Read logcat logs or debug crashes
- Tap buttons, enter text, or interact with app UI
- Take screenshots or inspect the accessibility tree

## Prerequisites

- **macOS or Linux** (Windows support coming)
- Node.js 18+
- Android SDK with `adb` and `emulator` in PATH
- An Android project with `gradlew` (for build operations)

## Setup

Run once after cloning:
```bash
cd /path/to/replicant-mcp
npm install
npm run install-skill
```

## Available Scripts

| Script | Purpose |
|--------|---------|
| `build-apk.sh` | Build debug or release APK |
| `run-tests.sh` | Run unit or instrumented tests |
| `list-modules.sh` | List Gradle modules |
| `build-details.sh` | Get full build/test output |
| `list-emulators.sh` | Show available AVDs |
| `start-emulator.sh` | Boot an emulator |
| `stop-emulator.sh` | Shut down an emulator |
| `snapshot.sh` | Manage emulator snapshots |
| `list-devices.sh` | Show connected devices |
| `select-device.sh` | Set active device |
| `install-app.sh` | Install APK to device |
| `launch-app.sh` | Start an app |
| `stop-app.sh` | Force stop an app |
| `uninstall-app.sh` | Remove app from device |
| `clear-data.sh` | Clear app data |
| `read-logs.sh` | Read filtered logcat |
| `dump-ui.sh` | Get accessibility tree |
| `find-element.sh` | Find UI elements |
| `tap-element.sh` | Tap a UI element |
| `input-text.sh` | Type text |
| `screenshot.sh` | Capture screen |
| `shell-cmd.sh` | Run adb shell command |
| `cache-stats.sh` | View cache statistics |
```

**Step 2: Commit**

```bash
mkdir -p skills/android-dev
git add skills/android-dev/SKILL.md
git commit -m "docs: add SKILL.md manifest for Claude Code"
```

---

## Task 12: Create Shell Scripts (Gradle)

**Files:**
- Create: `skills/android-dev/build-apk.sh`
- Create: `skills/android-dev/run-tests.sh`
- Create: `skills/android-dev/list-modules.sh`
- Create: `skills/android-dev/build-details.sh`

**Step 1: Create gradle skill scripts**

Create `skills/android-dev/build-apk.sh`:
```bash
#!/bin/bash
# Build an Android APK
# Usage: build-apk.sh [variant]
# Default variant: debug
# Examples:
#   build-apk.sh
#   build-apk.sh release

set -e
VARIANT="${1:-debug}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

case "$VARIANT" in
  debug)   $CLI gradle build assembleDebug ;;
  release) $CLI gradle build assembleRelease ;;
  bundle)  $CLI gradle build bundle ;;
  *)       echo "Unknown variant: $VARIANT"; exit 1 ;;
esac
```

Create `skills/android-dev/run-tests.sh`:
```bash
#!/bin/bash
# Run unit or instrumented tests
# Usage: run-tests.sh [--type unit|instrumented] [--module :app] [--class TestClass]
# Examples:
#   run-tests.sh
#   run-tests.sh --type instrumented
#   run-tests.sh --module :feature:login

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI gradle test "$@"
```

Create `skills/android-dev/list-modules.sh`:
```bash
#!/bin/bash
# List Gradle modules, variants, or tasks
# Usage: list-modules.sh [modules|variants|tasks]
# Default: modules

set -e
WHAT="${1:-modules}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI gradle list "$WHAT"
```

Create `skills/android-dev/build-details.sh`:
```bash
#!/bin/bash
# Get full output from cached build/test result
# Usage: build-details.sh <cacheId> [--errors|--full]
# Examples:
#   build-details.sh build-a1b2c3
#   build-details.sh build-a1b2c3 --errors

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI gradle details "$@"
```

**Step 2: Make scripts executable**

Run: `chmod +x skills/android-dev/*.sh`

**Step 3: Commit**

```bash
git add skills/android-dev/
git commit -m "feat(skills): add gradle scripts (build, test, list, details)"
```

---

## Task 13: Create Shell Scripts (ADB)

**Files:**
- Create: `skills/android-dev/list-devices.sh`
- Create: `skills/android-dev/select-device.sh`
- Create: `skills/android-dev/install-app.sh`
- Create: `skills/android-dev/launch-app.sh`
- Create: `skills/android-dev/stop-app.sh`
- Create: `skills/android-dev/uninstall-app.sh`
- Create: `skills/android-dev/clear-data.sh`
- Create: `skills/android-dev/read-logs.sh`
- Create: `skills/android-dev/shell-cmd.sh`

**Step 1: Create adb skill scripts**

Create `skills/android-dev/list-devices.sh`:
```bash
#!/bin/bash
# List connected Android devices
# Usage: list-devices.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb devices
```

Create `skills/android-dev/select-device.sh`:
```bash
#!/bin/bash
# Set active device for subsequent commands
# Usage: select-device.sh <deviceId>
# Example: select-device.sh emulator-5554

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: select-device.sh <deviceId>"
  exit 1
fi

$CLI adb select "$1"
```

Create `skills/android-dev/install-app.sh`:
```bash
#!/bin/bash
# Install APK to active device
# Usage: install-app.sh <apkPath>

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: install-app.sh <apkPath>"
  exit 1
fi

$CLI adb install "$1"
```

Create `skills/android-dev/launch-app.sh`:
```bash
#!/bin/bash
# Launch app on active device
# Usage: launch-app.sh <package>
# Example: launch-app.sh com.example.myapp

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: launch-app.sh <package>"
  exit 1
fi

$CLI adb launch "$1"
```

Create `skills/android-dev/stop-app.sh`:
```bash
#!/bin/bash
# Force stop app on active device
# Usage: stop-app.sh <package>

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: stop-app.sh <package>"
  exit 1
fi

$CLI adb stop "$1"
```

Create `skills/android-dev/uninstall-app.sh`:
```bash
#!/bin/bash
# Uninstall app from active device
# Usage: uninstall-app.sh <package>

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: uninstall-app.sh <package>"
  exit 1
fi

$CLI adb uninstall "$1"
```

Create `skills/android-dev/clear-data.sh`:
```bash
#!/bin/bash
# Clear app data on active device
# Usage: clear-data.sh <package>

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: clear-data.sh <package>"
  exit 1
fi

$CLI adb clear "$1"
```

Create `skills/android-dev/read-logs.sh`:
```bash
#!/bin/bash
# Read device logs (logcat)
# Usage: read-logs.sh [--level error|warn|info] [--lines N] [--tag TAG]
# Examples:
#   read-logs.sh
#   read-logs.sh --level error
#   read-logs.sh --lines 100 --tag MyApp

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI adb logcat "$@"
```

Create `skills/android-dev/shell-cmd.sh`:
```bash
#!/bin/bash
# Run adb shell command on active device
# Usage: shell-cmd.sh "<command>"
# Example: shell-cmd.sh "pm list packages"

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: shell-cmd.sh \"<command>\""
  exit 1
fi

$CLI adb shell "$1"
```

**Step 2: Make scripts executable**

Run: `chmod +x skills/android-dev/*.sh`

**Step 3: Commit**

```bash
git add skills/android-dev/
git commit -m "feat(skills): add adb scripts (devices, install, launch, logs, shell)"
```

---

## Task 14: Create Shell Scripts (Emulator)

**Files:**
- Create: `skills/android-dev/list-emulators.sh`
- Create: `skills/android-dev/start-emulator.sh`
- Create: `skills/android-dev/stop-emulator.sh`
- Create: `skills/android-dev/snapshot.sh`

**Step 1: Create emulator skill scripts**

Create `skills/android-dev/list-emulators.sh`:
```bash
#!/bin/bash
# List available Android emulators (AVDs)
# Usage: list-emulators.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI emulator list
```

Create `skills/android-dev/start-emulator.sh`:
```bash
#!/bin/bash
# Start an Android emulator
# Usage: start-emulator.sh <avdName> [--cold-boot] [--wipe-data]
# Examples:
#   start-emulator.sh Pixel_7_API_34
#   start-emulator.sh Pixel_7_API_34 --cold-boot

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: start-emulator.sh <avdName> [--cold-boot] [--wipe-data]"
  exit 1
fi

$CLI emulator start "$@"
```

Create `skills/android-dev/stop-emulator.sh`:
```bash
#!/bin/bash
# Stop a running emulator
# Usage: stop-emulator.sh <deviceId>
# Example: stop-emulator.sh emulator-5554

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: stop-emulator.sh <deviceId>"
  exit 1
fi

$CLI emulator stop "$1"
```

Create `skills/android-dev/snapshot.sh`:
```bash
#!/bin/bash
# Manage emulator snapshots
# Usage: snapshot.sh <save|load|list|delete> -d <deviceId> [-n <name>]
# Examples:
#   snapshot.sh list -d emulator-5554
#   snapshot.sh save -d emulator-5554 -n my-state
#   snapshot.sh load -d emulator-5554 -n my-state

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: snapshot.sh <save|load|list|delete> -d <deviceId> [-n <name>]"
  exit 1
fi

$CLI emulator snapshot "$@"
```

**Step 2: Make scripts executable**

Run: `chmod +x skills/android-dev/*.sh`

**Step 3: Commit**

```bash
git add skills/android-dev/
git commit -m "feat(skills): add emulator scripts (list, start, stop, snapshot)"
```

---

## Task 15: Create Shell Scripts (UI)

**Files:**
- Create: `skills/android-dev/dump-ui.sh`
- Create: `skills/android-dev/find-element.sh`
- Create: `skills/android-dev/tap-element.sh`
- Create: `skills/android-dev/input-text.sh`
- Create: `skills/android-dev/screenshot.sh`

**Step 1: Create UI skill scripts**

Create `skills/android-dev/dump-ui.sh`:
```bash
#!/bin/bash
# Dump accessibility tree of current screen
# Usage: dump-ui.sh [--json]

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui dump "$@"
```

Create `skills/android-dev/find-element.sh`:
```bash
#!/bin/bash
# Find UI elements by selector
# Usage: find-element.sh --text "Login" | --contains "Sign" | --id "btn_login"
# Examples:
#   find-element.sh --text "Login"
#   find-element.sh --contains "Sign"
#   find-element.sh --id "com.example:id/button"

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui find "$@"
```

Create `skills/android-dev/tap-element.sh`:
```bash
#!/bin/bash
# Tap a UI element
# Usage: tap-element.sh --index <N> | --x <X> --y <Y>
# Examples:
#   tap-element.sh --index 0
#   tap-element.sh --x 540 --y 1200

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui tap "$@"
```

Create `skills/android-dev/input-text.sh`:
```bash
#!/bin/bash
# Input text to focused element
# Usage: input-text.sh "<text>"
# Example: input-text.sh "hello@example.com"

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

if [ -z "$1" ]; then
  echo "Usage: input-text.sh \"<text>\""
  exit 1
fi

$CLI ui input "$1"
```

Create `skills/android-dev/screenshot.sh`:
```bash
#!/bin/bash
# Take screenshot of device screen
# Usage: screenshot.sh [output-path]
# Default: /tmp/screenshot-<timestamp>.png

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui screenshot "$@"
```

**Step 2: Make scripts executable**

Run: `chmod +x skills/android-dev/*.sh`

**Step 3: Commit**

```bash
git add skills/android-dev/
git commit -m "feat(skills): add UI scripts (dump, find, tap, input, screenshot)"
```

---

## Task 16: Create Shell Script (Cache)

**Files:**
- Create: `skills/android-dev/cache-stats.sh`

**Step 1: Create cache skill script**

Create `skills/android-dev/cache-stats.sh`:
```bash
#!/bin/bash
# View and manage output cache
# Usage: cache-stats.sh [stats|get <id>|clear]
# Examples:
#   cache-stats.sh
#   cache-stats.sh get build-a1b2c3
#   cache-stats.sh clear

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

ACTION="${1:-stats}"

case "$ACTION" in
  stats) $CLI cache stats ;;
  get)   $CLI cache get "$2" ;;
  clear) $CLI cache clear ;;
  *)     echo "Usage: cache-stats.sh [stats|get <id>|clear]"; exit 1 ;;
esac
```

**Step 2: Make script executable**

Run: `chmod +x skills/android-dev/cache-stats.sh`

**Step 3: Commit**

```bash
git add skills/android-dev/cache-stats.sh
git commit -m "feat(skills): add cache-stats script"
```

---

## Task 17: Create Install Script

**Files:**
- Create: `scripts/install-skill.sh`
- Modify: `package.json`

**Step 1: Create install script**

Create `scripts/install-skill.sh`:
```bash
#!/bin/bash
set -e

SKILL_DIR="$HOME/.claude/skills"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Installing Android Development skill..."

# Build if needed
if [ ! -f "$SCRIPT_DIR/dist/cli.js" ]; then
  echo "Building CLI..."
  cd "$SCRIPT_DIR"
  npm run build
fi

# Create skills dir if needed
mkdir -p "$SKILL_DIR"

# Remove old installation, symlink new
rm -rf "$SKILL_DIR/android-dev"
ln -s "$SCRIPT_DIR/skills/android-dev" "$SKILL_DIR/android-dev"

echo ""
echo "✓ Installed to $SKILL_DIR/android-dev"
echo "→ Restart Claude Code to activate"
```

**Step 2: Make script executable**

Run: `chmod +x scripts/install-skill.sh`

**Step 3: Add npm script**

Add to `package.json` scripts:
```json
"install-skill": "bash scripts/install-skill.sh"
```

**Step 4: Commit**

```bash
git add scripts/install-skill.sh package.json
git commit -m "feat: add install-skill script for easy setup"
```

---

## Task 18: Create Skill Validation Test

**Files:**
- Create: `tests/skills/validation.test.ts`

**Step 1: Write skill validation tests**

Create `tests/skills/validation.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const SKILLS_DIR = join(process.cwd(), "skills/android-dev");

describe("Skill Scripts Validation", () => {
  const scripts = readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith(".sh"));

  it("should have SKILL.md manifest", () => {
    const manifest = join(SKILLS_DIR, "SKILL.md");
    expect(statSync(manifest).isFile()).toBe(true);
  });

  it("should have expected number of scripts", () => {
    expect(scripts.length).toBeGreaterThanOrEqual(20);
  });

  scripts.forEach(script => {
    describe(script, () => {
      const scriptPath = join(SKILLS_DIR, script);

      it("should be executable", () => {
        const stat = statSync(scriptPath);
        const mode = stat.mode & 0o111; // executable bits
        expect(mode).toBeGreaterThan(0);
      });

      it("should have bash shebang", () => {
        const content = readFileSync(scriptPath, "utf-8");
        expect(content.startsWith("#!/bin/bash")).toBe(true);
      });

      it("should have usage comment", () => {
        const content = readFileSync(scriptPath, "utf-8");
        expect(content).toContain("# Usage:");
      });

      it("should use set -e for error handling", () => {
        const content = readFileSync(scriptPath, "utf-8");
        expect(content).toContain("set -e");
      });
    });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --run tests/skills/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/skills/validation.test.ts
git commit -m "test: add skill script validation tests"
```

---

## Task 19: Update README with Skill Documentation

**Files:**
- Modify: `README.md`

**Step 1: Add skill usage section to README**

Add after the "Connect to Claude Desktop" section:

```markdown
### Option 2: Claude Code Skill

If you use [Claude Code](https://github.com/anthropics/claude-code), you can install replicant as a skill:

```bash
git clone https://github.com/thecombatwombat/replicant-mcp.git
cd replicant-mcp
npm install
npm run install-skill
```

Restart Claude Code. The skill auto-detects when you ask about Android development tasks.

> **Note:** Skills require macOS or Linux. Windows users need WSL.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Claude Code skill installation instructions"
```

---

## Task 20: Final Verification

**Step 1: Run all tests**

Run: `npm run validate`
Expected: Build succeeds, all tests pass

**Step 2: Verify CLI works**

Run: `node dist/cli.js --help`
Expected: Shows all command groups

Run: `node dist/cli.js gradle --help`
Expected: Shows gradle subcommands

**Step 3: Verify skill scripts are valid**

Run: `ls -la skills/android-dev/*.sh | wc -l`
Expected: 21 or more scripts

Run: `head -3 skills/android-dev/build-apk.sh`
Expected: Shows shebang and comment

**Step 4: Create summary commit**

```bash
git add -A
git commit -m "feat: complete Android Dev skill implementation

- CLI entry point with all commands (gradle, adb, emulator, ui, cache)
- Token-efficient output formatters
- 21 shell scripts for Claude Code skill
- Install script for easy setup
- Validation tests for scripts
- Updated README with skill docs"
```

---

## Summary

| Task | Component | Files |
|------|-----------|-------|
| 1 | Dependencies | package.json |
| 2 | CLI scaffold | src/cli.ts |
| 3-4 | Formatters | src/cli/formatter.ts, tests |
| 5-9 | CLI commands | src/cli/{gradle,adb,emulator,ui,cache}.ts |
| 10 | CLI index | src/cli/index.ts |
| 11 | SKILL.md | skills/android-dev/SKILL.md |
| 12-16 | Shell scripts | skills/android-dev/*.sh (21 scripts) |
| 17 | Install script | scripts/install-skill.sh |
| 18 | Validation tests | tests/skills/validation.test.ts |
| 19 | Documentation | README.md |
| 20 | Final verification | - |

**Total: 20 tasks**
