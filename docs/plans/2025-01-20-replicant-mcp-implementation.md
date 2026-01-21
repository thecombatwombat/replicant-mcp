# replicant-mcp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-grade Android MCP server with 12 tools for build, emulator, ADB, and UI automation.

**Architecture:** TypeScript MCP server using operation enum consolidation. Three layers: tools (MCP interface) → adapters (CLI wrappers) → services (caching, state, process execution). Progressive disclosure via cache IDs.

**Tech Stack:** TypeScript, Node.js, @modelcontextprotocol/sdk, execa, vitest

---

## Phase 1: Project Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.ts`

**Step 1: Initialize package.json**

```bash
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk execa zod
npm install -D typescript @types/node vitest
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Update package.json scripts and type**

Add to package.json:
```json
{
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "start": "node dist/index.js"
  }
}
```

**Step 5: Create minimal src/index.ts**

```typescript
#!/usr/bin/env node
console.log("replicant-mcp starting...");
```

**Step 6: Verify build works**

```bash
npm run build
node dist/index.js
```

Expected: "replicant-mcp starting..."

**Step 7: Update .gitignore**

```gitignore
node_modules/
dist/
*.log
.env
```

**Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore src/index.ts
git commit -m "chore: initialize TypeScript project with MCP SDK"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types/errors.ts`
- Create: `src/types/cache.ts`
- Create: `src/types/device.ts`
- Create: `src/types/index.ts`

**Step 1: Create src/types/errors.ts**

```typescript
export const ErrorCode = {
  // Device errors
  NO_DEVICE_SELECTED: "NO_DEVICE_SELECTED",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  DEVICE_OFFLINE: "DEVICE_OFFLINE",

  // Build errors
  BUILD_FAILED: "BUILD_FAILED",
  GRADLE_NOT_FOUND: "GRADLE_NOT_FOUND",
  MODULE_NOT_FOUND: "MODULE_NOT_FOUND",

  // App errors
  APK_NOT_FOUND: "APK_NOT_FOUND",
  PACKAGE_NOT_FOUND: "PACKAGE_NOT_FOUND",
  INSTALL_FAILED: "INSTALL_FAILED",

  // Emulator errors
  AVD_NOT_FOUND: "AVD_NOT_FOUND",
  EMULATOR_START_FAILED: "EMULATOR_START_FAILED",
  SNAPSHOT_NOT_FOUND: "SNAPSHOT_NOT_FOUND",

  // Safety errors
  COMMAND_BLOCKED: "COMMAND_BLOCKED",
  TIMEOUT: "TIMEOUT",

  // Cache errors
  CACHE_MISS: "CACHE_MISS",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ToolError {
  error: ErrorCode;
  message: string;
  suggestion?: string;
  details?: Record<string, unknown>;
}

export class ReplicantError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly suggestion?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ReplicantError";
  }

  toToolError(): ToolError {
    return {
      error: this.code,
      message: this.message,
      suggestion: this.suggestion,
      details: this.details,
    };
  }
}
```

**Step 2: Create src/types/cache.ts**

```typescript
export interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
  metadata: {
    createdAt: number;
    type: string;
    sizeBytes?: number;
  };
}

export interface CacheConfig {
  maxEntries: number;
  maxEntrySizeBytes: number;
  defaultTtlMs: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 100,
  maxEntrySizeBytes: 1024 * 1024, // 1MB
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
};

export const CACHE_TTLS = {
  BUILD_OUTPUT: 30 * 60 * 1000, // 30 min
  TEST_RESULTS: 30 * 60 * 1000, // 30 min
  EMULATOR_LIST: 5 * 60 * 1000, // 5 min
  APP_LIST: 2 * 60 * 1000, // 2 min
  UI_TREE: 30 * 1000, // 30 sec
  GRADLE_VARIANTS: 60 * 60 * 1000, // 1 hour
} as const;
```

**Step 3: Create src/types/device.ts**

```typescript
export type DeviceType = "emulator" | "physical";
export type DeviceStatus = "online" | "offline" | "booting";

export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  status: DeviceStatus;
}

export interface DeviceState {
  currentDevice: Device | null;
}
```

**Step 4: Create src/types/index.ts**

```typescript
export * from "./errors.js";
export * from "./cache.js";
export * from "./device.js";
```

**Step 5: Verify types compile**

```bash
npm run build
```

Expected: No errors

**Step 6: Commit**

```bash
git add src/types/
git commit -m "feat: add core type definitions for errors, cache, and device state"
```

---

### Task 3: Process Runner Service

**Files:**
- Create: `src/services/process-runner.ts`
- Create: `tests/services/process-runner.test.ts`

**Step 1: Write failing test for basic command execution**

Create `tests/services/process-runner.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ProcessRunner } from "../src/services/process-runner.js";

describe("ProcessRunner", () => {
  const runner = new ProcessRunner();

  describe("run", () => {
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
      ).rejects.toThrow("TIMEOUT");
    });
  });

  describe("safety guards", () => {
    it("blocks dangerous commands", async () => {
      await expect(runner.run("rm", ["-rf", "/"])).rejects.toThrow(
        "COMMAND_BLOCKED"
      );
    });

    it("blocks reboot commands", async () => {
      await expect(runner.run("reboot", [])).rejects.toThrow("COMMAND_BLOCKED");
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/services/process-runner.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement ProcessRunner**

Create `src/services/process-runner.ts`:

```typescript
import { execa, ExecaError } from "execa";
import { ReplicantError, ErrorCode } from "../types/index.js";

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
  /^rm\s+(-[rf]+\s+)*\//,  // rm -rf /
  /^su(\s|$)/,             // su
  /^sudo(\s|$)/,           // sudo
  /\bformat\b/,            // format commands
];

export class ProcessRunner {
  private readonly defaultTimeoutMs = 30_000;
  private readonly maxTimeoutMs = 120_000;

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
        reject: false,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 0,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("timed out")) {
        throw new ReplicantError(
          ErrorCode.TIMEOUT,
          `Command timed out after ${timeoutMs}ms`,
          "Try increasing the timeout or simplifying the command"
        );
      }
      throw error;
    }
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

**Step 4: Run tests to verify they pass**

```bash
npm test -- tests/services/process-runner.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/services/process-runner.ts tests/services/process-runner.test.ts
git commit -m "feat: add ProcessRunner service with safety guards"
```

---

### Task 4: Cache Manager Service

**Files:**
- Create: `src/services/cache-manager.ts`
- Create: `tests/services/cache-manager.test.ts`

**Step 1: Write failing tests**

Create `tests/services/cache-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheManager } from "../src/services/cache-manager.js";

describe("CacheManager", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ maxEntries: 3, maxEntrySizeBytes: 1024, defaultTtlMs: 1000 });
  });

  describe("set and get", () => {
    it("stores and retrieves a value", () => {
      cache.set("test-id", { data: "hello" }, "test");
      const result = cache.get("test-id");
      expect(result?.data).toEqual({ data: "hello" });
    });

    it("returns undefined for missing keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("returns undefined for expired entries", async () => {
      cache.set("test-id", { data: "hello" }, "test", 10); // 10ms TTL
      await new Promise((r) => setTimeout(r, 50));
      expect(cache.get("test-id")).toBeUndefined();
    });
  });

  describe("generateId", () => {
    it("generates unique IDs with type prefix", () => {
      const id1 = cache.generateId("build");
      const id2 = cache.generateId("build");
      expect(id1).toMatch(/^build-[a-z0-9]+-\d+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when maxEntries exceeded", () => {
      cache.set("a", { v: 1 }, "test");
      cache.set("b", { v: 2 }, "test");
      cache.set("c", { v: 3 }, "test");
      cache.set("d", { v: 4 }, "test"); // Should evict "a"

      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeDefined();
      expect(cache.get("c")).toBeDefined();
      expect(cache.get("d")).toBeDefined();
    });
  });

  describe("invalidation", () => {
    it("clears specific key", () => {
      cache.set("test-id", { data: "hello" }, "test");
      cache.clear("test-id");
      expect(cache.get("test-id")).toBeUndefined();
    });

    it("clears all entries", () => {
      cache.set("a", { v: 1 }, "test");
      cache.set("b", { v: 2 }, "test");
      cache.clearAll();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
    });

    it("invalidates by type", () => {
      cache.set("build-1", { v: 1 }, "build");
      cache.set("test-1", { v: 2 }, "test");
      cache.invalidateByType("build");
      expect(cache.get("build-1")).toBeUndefined();
      expect(cache.get("test-1")).toBeDefined();
    });
  });

  describe("stats", () => {
    it("returns cache statistics", () => {
      cache.set("a", { v: 1 }, "build");
      cache.set("b", { v: 2 }, "test");
      const stats = cache.getStats();
      expect(stats.entryCount).toBe(2);
      expect(stats.typeBreakdown).toEqual({ build: 1, test: 1 });
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/services/cache-manager.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement CacheManager**

Create `src/services/cache-manager.ts`:

```typescript
import { CacheEntry, CacheConfig, DEFAULT_CACHE_CONFIG } from "../types/index.js";
import { createHash, randomBytes } from "crypto";

export interface CacheStats {
  entryCount: number;
  totalSizeBytes: number;
  typeBreakdown: Record<string, number>;
  config: CacheConfig;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  generateId(type: string): string {
    const hash = randomBytes(4).toString("hex");
    const timestamp = Date.now();
    return `${type}-${hash}-${timestamp}`;
  }

  set<T>(id: string, data: T, type: string, ttlMs?: number): void {
    const now = Date.now();
    const sizeBytes = JSON.stringify(data).length;

    // Enforce max entry size
    if (sizeBytes > this.config.maxEntrySizeBytes) {
      // Truncate or reject - for now we store but track
    }

    // LRU eviction
    while (this.cache.size >= this.config.maxEntries) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + (ttlMs ?? this.config.defaultTtlMs),
      metadata: {
        createdAt: now,
        type,
        sizeBytes,
      },
    };

    this.cache.set(id, entry);
    this.accessOrder.push(id);
  }

  get<T>(id: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(id) as CacheEntry<T> | undefined;

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(id);
      this.accessOrder = this.accessOrder.filter((k) => k !== id);
      return undefined;
    }

    // Update access order for LRU
    this.accessOrder = this.accessOrder.filter((k) => k !== id);
    this.accessOrder.push(id);

    return entry;
  }

  clear(id: string): void {
    this.cache.delete(id);
    this.accessOrder = this.accessOrder.filter((k) => k !== id);
  }

  clearAll(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  invalidateByType(type: string): void {
    for (const [id, entry] of this.cache.entries()) {
      if (entry.metadata.type === type) {
        this.cache.delete(id);
      }
    }
    this.accessOrder = this.accessOrder.filter((id) => this.cache.has(id));
  }

  getStats(): CacheStats {
    const typeBreakdown: Record<string, number> = {};
    let totalSizeBytes = 0;

    for (const entry of this.cache.values()) {
      const type = entry.metadata.type;
      typeBreakdown[type] = (typeBreakdown[type] ?? 0) + 1;
      totalSizeBytes += entry.metadata.sizeBytes ?? 0;
    }

    return {
      entryCount: this.cache.size,
      totalSizeBytes,
      typeBreakdown,
      config: this.config,
    };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- tests/services/cache-manager.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/services/cache-manager.ts tests/services/cache-manager.test.ts
git commit -m "feat: add CacheManager service with LRU eviction and TTL"
```

---

### Task 5: Device State Service

**Files:**
- Create: `src/services/device-state.ts`
- Create: `tests/services/device-state.test.ts`

**Step 1: Write failing tests**

Create `tests/services/device-state.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { DeviceStateManager } from "../src/services/device-state.js";

describe("DeviceStateManager", () => {
  let state: DeviceStateManager;

  beforeEach(() => {
    state = new DeviceStateManager();
  });

  describe("current device", () => {
    it("starts with no device selected", () => {
      expect(state.getCurrentDevice()).toBeNull();
    });

    it("selects a device", () => {
      state.setCurrentDevice({
        id: "emulator-5554",
        type: "emulator",
        name: "Pixel_7_API_34",
        status: "online",
      });

      const device = state.getCurrentDevice();
      expect(device?.id).toBe("emulator-5554");
      expect(device?.type).toBe("emulator");
    });

    it("clears the current device", () => {
      state.setCurrentDevice({
        id: "emulator-5554",
        type: "emulator",
        name: "Pixel_7_API_34",
        status: "online",
      });
      state.clearCurrentDevice();
      expect(state.getCurrentDevice()).toBeNull();
    });
  });

  describe("requireCurrentDevice", () => {
    it("throws when no device selected", () => {
      expect(() => state.requireCurrentDevice()).toThrow("NO_DEVICE_SELECTED");
    });

    it("returns device when selected", () => {
      state.setCurrentDevice({
        id: "emulator-5554",
        type: "emulator",
        name: "Pixel_7_API_34",
        status: "online",
      });
      const device = state.requireCurrentDevice();
      expect(device.id).toBe("emulator-5554");
    });
  });

  describe("auto-selection", () => {
    it("auto-selects when only one device available", () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "Pixel", status: "online" as const },
      ];
      state.autoSelectIfSingle(devices);
      expect(state.getCurrentDevice()?.id).toBe("emulator-5554");
    });

    it("does not auto-select when multiple devices available", () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "Pixel", status: "online" as const },
        { id: "emulator-5556", type: "emulator" as const, name: "Nexus", status: "online" as const },
      ];
      state.autoSelectIfSingle(devices);
      expect(state.getCurrentDevice()).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/services/device-state.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement DeviceStateManager**

Create `src/services/device-state.ts`:

```typescript
import { Device, ReplicantError, ErrorCode } from "../types/index.js";

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

  autoSelectIfSingle(devices: Device[]): boolean {
    if (devices.length === 1 && !this.currentDevice) {
      this.currentDevice = devices[0];
      return true;
    }
    return false;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- tests/services/device-state.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/services/device-state.ts tests/services/device-state.test.ts
git commit -m "feat: add DeviceStateManager service with auto-selection"
```

---

### Task 6: Services Index

**Files:**
- Create: `src/services/index.ts`

**Step 1: Create services barrel export**

```typescript
export { ProcessRunner, type RunOptions, type RunResult } from "./process-runner.js";
export { CacheManager, type CacheStats } from "./cache-manager.js";
export { DeviceStateManager } from "./device-state.js";
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/services/index.ts
git commit -m "chore: add services barrel export"
```

---

## Phase 2: CLI Adapters

### Task 7: ADB Adapter

**Files:**
- Create: `src/adapters/adb.ts`
- Create: `src/parsers/adb-output.ts`
- Create: `tests/adapters/adb.test.ts`
- Create: `tests/fixtures/adb-devices.txt`

**Step 1: Create test fixture**

Create `tests/fixtures/adb-devices.txt`:

```
List of devices attached
emulator-5554	device
192.168.1.100:5555	device
```

**Step 2: Write failing tests for ADB output parsing**

Create `tests/adapters/adb.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseDeviceList, parsePackageList } from "../src/parsers/adb-output.js";

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
```

**Step 3: Run test to verify it fails**

```bash
npm test -- tests/adapters/adb.test.ts
```

Expected: FAIL - module not found

**Step 4: Implement ADB output parser**

Create `src/parsers/adb-output.ts`:

```typescript
import { Device, DeviceType, DeviceStatus } from "../types/index.js";

export function parseDeviceList(output: string): Device[] {
  const lines = output.split("\n").slice(1); // Skip header
  const devices: Device[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [id, statusStr] = trimmed.split(/\s+/);
    if (!id) continue;

    const type: DeviceType = id.startsWith("emulator") ? "emulator" : "physical";
    const status: DeviceStatus = statusStr === "device" ? "online" : "offline";

    devices.push({
      id,
      type,
      name: id, // Can be enriched later with getprop
      status,
    });
  }

  return devices;
}

export function parsePackageList(output: string): string[] {
  return output
    .split("\n")
    .filter((line) => line.startsWith("package:"))
    .map((line) => line.replace("package:", "").trim());
}

export function parseGetProp(output: string, prop: string): string | undefined {
  const regex = new RegExp(`\\[${prop}\\]:\\s*\\[(.*)\\]`);
  const match = output.match(regex);
  return match?.[1];
}
```

**Step 5: Run tests to verify parser passes**

```bash
npm test -- tests/adapters/adb.test.ts
```

Expected: All tests PASS

**Step 6: Implement ADB Adapter**

Create `src/adapters/adb.ts`:

```typescript
import { ProcessRunner, RunResult } from "../services/index.js";
import { Device, ReplicantError, ErrorCode } from "../types/index.js";
import { parseDeviceList, parsePackageList } from "../parsers/adb-output.js";

export class AdbAdapter {
  constructor(private runner: ProcessRunner = new ProcessRunner()) {}

  async getDevices(): Promise<Device[]> {
    const result = await this.adb(["devices"]);
    return parseDeviceList(result.stdout);
  }

  async getPackages(deviceId: string): Promise<string[]> {
    const result = await this.adb(["-s", deviceId, "shell", "pm", "list", "packages"]);
    return parsePackageList(result.stdout);
  }

  async install(deviceId: string, apkPath: string): Promise<void> {
    const result = await this.adb(["-s", deviceId, "install", "-r", apkPath]);
    if (result.exitCode !== 0 || result.stdout.includes("Failure")) {
      throw new ReplicantError(
        ErrorCode.INSTALL_FAILED,
        `Failed to install APK: ${result.stdout}`,
        "Check the APK path and device state"
      );
    }
  }

  async uninstall(deviceId: string, packageName: string): Promise<void> {
    const result = await this.adb(["-s", deviceId, "uninstall", packageName]);
    if (result.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.PACKAGE_NOT_FOUND,
        `Failed to uninstall ${packageName}`,
        "Check the package name"
      );
    }
  }

  async launch(deviceId: string, packageName: string): Promise<void> {
    // Get the main activity using dumpsys
    const result = await this.adb([
      "-s", deviceId, "shell", "monkey",
      "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1"
    ]);
    if (result.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.PACKAGE_NOT_FOUND,
        `Failed to launch ${packageName}`,
        "Check the package name and ensure the app is installed"
      );
    }
  }

  async stop(deviceId: string, packageName: string): Promise<void> {
    await this.adb(["-s", deviceId, "shell", "am", "force-stop", packageName]);
  }

  async clearData(deviceId: string, packageName: string): Promise<void> {
    await this.adb(["-s", deviceId, "shell", "pm", "clear", packageName]);
  }

  async shell(deviceId: string, command: string, timeoutMs?: number): Promise<RunResult> {
    return this.adb(["-s", deviceId, "shell", command], timeoutMs);
  }

  async logcat(
    deviceId: string,
    options: { lines?: number; filter?: string }
  ): Promise<string> {
    const args = ["-s", deviceId, "logcat", "-d"];

    if (options.lines) {
      args.push("-t", options.lines.toString());
    }

    if (options.filter) {
      args.push(...options.filter.split(" "));
    }

    const result = await this.adb(args);
    return result.stdout;
  }

  async waitForDevice(deviceId: string, timeoutMs = 30000): Promise<void> {
    await this.adb(["-s", deviceId, "wait-for-device"], timeoutMs);
  }

  async getProperties(deviceId: string): Promise<Record<string, string>> {
    const result = await this.adb(["-s", deviceId, "shell", "getprop"]);
    const props: Record<string, string> = {};

    const regex = /\[([^\]]+)\]:\s*\[([^\]]*)\]/g;
    let match;
    while ((match = regex.exec(result.stdout)) !== null) {
      props[match[1]] = match[2];
    }

    return props;
  }

  private async adb(args: string[], timeoutMs?: number): Promise<RunResult> {
    return this.runner.run("adb", args, { timeoutMs });
  }
}
```

**Step 7: Commit**

```bash
git add src/adapters/adb.ts src/parsers/adb-output.ts tests/adapters/adb.test.ts tests/fixtures/
git commit -m "feat: add ADB adapter with device and app management"
```

---

### Task 8: Emulator Adapter

**Files:**
- Create: `src/adapters/emulator.ts`
- Create: `src/parsers/emulator-output.ts`
- Create: `tests/adapters/emulator.test.ts`

**Step 1: Write failing tests for emulator output parsing**

Create `tests/adapters/emulator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseAvdList, parseEmulatorList } from "../src/parsers/emulator-output.js";

describe("Emulator Output Parsing", () => {
  describe("parseAvdList", () => {
    it("parses avdmanager list output", () => {
      const output = `Available Android Virtual Devices:
    Name: Pixel_7_API_34
    Path: /Users/test/.android/avd/Pixel_7_API_34.avd
  Target: Google APIs (Google Inc.)
          Based on: Android 14.0 (UpsideDownCake)
    Skin: pixel_7
---------
    Name: Nexus_5_API_30
    Path: /Users/test/.android/avd/Nexus_5_API_30.avd
  Target: Google APIs (Google Inc.)
          Based on: Android 11.0 (R)
    Skin: nexus_5
`;
      const avds = parseAvdList(output);
      expect(avds).toHaveLength(2);
      expect(avds[0].name).toBe("Pixel_7_API_34");
      expect(avds[1].name).toBe("Nexus_5_API_30");
    });
  });

  describe("parseEmulatorList", () => {
    it("parses running emulator list", () => {
      const output = `emulator-5554
emulator-5556
`;
      const running = parseEmulatorList(output);
      expect(running).toEqual(["emulator-5554", "emulator-5556"]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/adapters/emulator.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement emulator output parser**

Create `src/parsers/emulator-output.ts`:

```typescript
export interface AvdInfo {
  name: string;
  path?: string;
  target?: string;
  skin?: string;
}

export function parseAvdList(output: string): AvdInfo[] {
  const avds: AvdInfo[] = [];
  const blocks = output.split("---------");

  for (const block of blocks) {
    const nameMatch = block.match(/Name:\s*(.+)/);
    if (!nameMatch) continue;

    const pathMatch = block.match(/Path:\s*(.+)/);
    const targetMatch = block.match(/Target:\s*(.+)/);
    const skinMatch = block.match(/Skin:\s*(.+)/);

    avds.push({
      name: nameMatch[1].trim(),
      path: pathMatch?.[1].trim(),
      target: targetMatch?.[1].trim(),
      skin: skinMatch?.[1].trim(),
    });
  }

  return avds;
}

export function parseEmulatorList(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("emulator-"));
}

export function parseSnapshotList(output: string): string[] {
  // Output format: "snapshot_name    size    date"
  return output
    .split("\n")
    .slice(1) // Skip header
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}
```

**Step 4: Run tests**

```bash
npm test -- tests/adapters/emulator.test.ts
```

Expected: All tests PASS

**Step 5: Implement Emulator Adapter**

Create `src/adapters/emulator.ts`:

```typescript
import { ProcessRunner } from "../services/index.js";
import { ReplicantError, ErrorCode } from "../types/index.js";
import { parseAvdList, parseEmulatorList, parseSnapshotList, AvdInfo } from "../parsers/emulator-output.js";

export interface EmulatorListResult {
  available: AvdInfo[];
  running: string[];
}

export class EmulatorAdapter {
  constructor(private runner: ProcessRunner = new ProcessRunner()) {}

  async list(): Promise<EmulatorListResult> {
    const [avdResult, runningResult] = await Promise.all([
      this.runner.run("avdmanager", ["list", "avd"]),
      this.runner.run("emulator", ["-list-avds"]),
    ]);

    return {
      available: parseAvdList(avdResult.stdout),
      running: parseEmulatorList(runningResult.stdout),
    };
  }

  async create(
    name: string,
    device: string,
    systemImage: string
  ): Promise<void> {
    const result = await this.runner.run("avdmanager", [
      "create", "avd",
      "-n", name,
      "-k", systemImage,
      "-d", device,
      "--force",
    ], { timeoutMs: 60000 });

    if (result.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.EMULATOR_START_FAILED,
        `Failed to create AVD: ${result.stderr}`,
        "Check device and system image names"
      );
    }
  }

  async start(avdName: string): Promise<string> {
    // Start emulator in background - don't wait for it
    // Returns immediately, emulator boots in background
    const child = this.runner.run("emulator", [
      "-avd", avdName,
      "-no-snapshot-load",
      "-no-boot-anim",
    ], { timeoutMs: 5000 }).catch(() => {
      // Expected to "timeout" as emulator runs forever
    });

    // Give it a moment to register
    await new Promise((r) => setTimeout(r, 2000));

    // Find the new emulator ID
    const result = await this.runner.run("adb", ["devices"]);
    const match = result.stdout.match(/emulator-\d+/);

    if (!match) {
      throw new ReplicantError(
        ErrorCode.EMULATOR_START_FAILED,
        `Emulator ${avdName} failed to start`,
        "Check the AVD name and try again"
      );
    }

    return match[0];
  }

  async kill(emulatorId: string): Promise<void> {
    await this.runner.run("adb", ["-s", emulatorId, "emu", "kill"]);
  }

  async wipe(avdName: string): Promise<void> {
    await this.runner.run("emulator", ["-avd", avdName, "-wipe-data", "-no-window"], { timeoutMs: 5000 }).catch(() => {
      // Expected behavior
    });
  }

  async snapshotSave(emulatorId: string, name: string): Promise<void> {
    await this.runner.run("adb", ["-s", emulatorId, "emu", "avd", "snapshot", "save", name]);
  }

  async snapshotLoad(emulatorId: string, name: string): Promise<void> {
    await this.runner.run("adb", ["-s", emulatorId, "emu", "avd", "snapshot", "load", name]);
  }

  async snapshotList(emulatorId: string): Promise<string[]> {
    const result = await this.runner.run("adb", ["-s", emulatorId, "emu", "avd", "snapshot", "list"]);
    return parseSnapshotList(result.stdout);
  }

  async snapshotDelete(emulatorId: string, name: string): Promise<void> {
    await this.runner.run("adb", ["-s", emulatorId, "emu", "avd", "snapshot", "delete", name]);
  }
}
```

**Step 6: Commit**

```bash
git add src/adapters/emulator.ts src/parsers/emulator-output.ts tests/adapters/emulator.test.ts
git commit -m "feat: add Emulator adapter with AVD and snapshot management"
```

---

### Task 9: Gradle Adapter

**Files:**
- Create: `src/adapters/gradle.ts`
- Create: `src/parsers/gradle-output.ts`
- Create: `tests/adapters/gradle.test.ts`

**Step 1: Write failing tests for Gradle output parsing**

Create `tests/adapters/gradle.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseBuildOutput, parseTestOutput, parseModuleList } from "../src/parsers/gradle-output.js";

describe("Gradle Output Parsing", () => {
  describe("parseBuildOutput", () => {
    it("parses successful build", () => {
      const output = `> Task :app:assembleDebug

BUILD SUCCESSFUL in 47s
42 actionable tasks: 42 executed
`;
      const result = parseBuildOutput(output);
      expect(result.success).toBe(true);
      expect(result.duration).toBe("47s");
      expect(result.tasksExecuted).toBe(42);
    });

    it("parses failed build", () => {
      const output = `> Task :app:compileDebugKotlin FAILED

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':app:compileDebugKotlin'.

BUILD FAILED in 12s
`;
      const result = parseBuildOutput(output);
      expect(result.success).toBe(false);
      expect(result.failedTask).toBe(":app:compileDebugKotlin");
    });

    it("counts warnings", () => {
      const output = `w: Some warning here
w: Another warning
BUILD SUCCESSFUL in 5s
`;
      const result = parseBuildOutput(output);
      expect(result.warnings).toBe(2);
    });
  });

  describe("parseTestOutput", () => {
    it("parses test results", () => {
      const output = `> Task :app:testDebugUnitTest

com.example.MyTest > testSomething PASSED
com.example.MyTest > testAnother PASSED
com.example.MyTest > testFailing FAILED

3 tests completed, 1 failed
`;
      const result = parseTestOutput(output);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(3);
    });
  });

  describe("parseModuleList", () => {
    it("parses project list", () => {
      const output = `
Root project 'MyApp'
+--- Project ':app'
+--- Project ':core'
\\--- Project ':feature:login'
`;
      const modules = parseModuleList(output);
      expect(modules).toEqual([":app", ":core", ":feature:login"]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/adapters/gradle.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement Gradle output parser**

Create `src/parsers/gradle-output.ts`:

```typescript
export interface BuildResult {
  success: boolean;
  duration?: string;
  tasksExecuted?: number;
  warnings: number;
  errors: number;
  failedTask?: string;
  apkPath?: string;
}

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: string;
  failures: Array<{ test: string; message: string }>;
}

export function parseBuildOutput(output: string): BuildResult {
  const success = output.includes("BUILD SUCCESSFUL");
  const durationMatch = output.match(/BUILD (?:SUCCESSFUL|FAILED) in (\S+)/);
  const tasksMatch = output.match(/(\d+) actionable tasks/);
  const failedTaskMatch = output.match(/Task (:\S+) FAILED/);
  const warnings = (output.match(/^w:/gm) || []).length;
  const errors = (output.match(/^e:/gm) || []).length;

  // Try to find APK path
  const apkMatch = output.match(/(\S+\.apk)/);

  return {
    success,
    duration: durationMatch?.[1],
    tasksExecuted: tasksMatch ? parseInt(tasksMatch[1], 10) : undefined,
    warnings,
    errors,
    failedTask: failedTaskMatch?.[1],
    apkPath: apkMatch?.[1],
  };
}

export function parseTestOutput(output: string): TestResult {
  const summaryMatch = output.match(/(\d+) tests? completed(?:, (\d+) failed)?(?:, (\d+) skipped)?/);

  const total = summaryMatch ? parseInt(summaryMatch[1], 10) : 0;
  const failed = summaryMatch?.[2] ? parseInt(summaryMatch[2], 10) : 0;
  const skipped = summaryMatch?.[3] ? parseInt(summaryMatch[3], 10) : 0;
  const passed = total - failed - skipped;

  const durationMatch = output.match(/in (\S+)/);

  // Extract failure details
  const failures: Array<{ test: string; message: string }> = [];
  const failureRegex = /(\S+) > (\S+) FAILED/g;
  let match;
  while ((match = failureRegex.exec(output)) !== null) {
    failures.push({ test: `${match[1]}.${match[2]}`, message: "" });
  }

  return {
    passed,
    failed,
    skipped,
    total,
    duration: durationMatch?.[1],
    failures,
  };
}

export function parseModuleList(output: string): string[] {
  const modules: string[] = [];
  const regex = /Project '(:\S+)'/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    modules.push(match[1]);
  }
  return modules;
}

export interface VariantInfo {
  name: string;
  buildType: string;
  flavors: string[];
}

export function parseVariantList(output: string): VariantInfo[] {
  // This is a simplified parser - actual output varies by project
  const variants: VariantInfo[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(">") || trimmed.startsWith("Task")) continue;

    // Common pattern: "debug", "release", "freeDebug", "paidRelease"
    if (/^[a-z]+[A-Z]?[a-z]*$/.test(trimmed)) {
      const isDebug = trimmed.toLowerCase().includes("debug");
      const isRelease = trimmed.toLowerCase().includes("release");
      const buildType = isDebug ? "debug" : isRelease ? "release" : trimmed;

      const flavorPart = trimmed.replace(/debug|release/gi, "");
      const flavors = flavorPart ? [flavorPart.toLowerCase()] : [];

      variants.push({ name: trimmed, buildType, flavors });
    }
  }

  return variants;
}

export function parseTaskList(output: string): string[] {
  const tasks: string[] = [];
  const regex = /^(\S+) - /gm;
  let match;
  while ((match = regex.exec(output)) !== null) {
    tasks.push(match[1]);
  }
  return tasks;
}
```

**Step 4: Run tests**

```bash
npm test -- tests/adapters/gradle.test.ts
```

Expected: All tests PASS

**Step 5: Implement Gradle Adapter**

Create `src/adapters/gradle.ts`:

```typescript
import { ProcessRunner } from "../services/index.js";
import { ReplicantError, ErrorCode } from "../types/index.js";
import {
  parseBuildOutput,
  parseTestOutput,
  parseModuleList,
  parseVariantList,
  parseTaskList,
  BuildResult,
  TestResult,
  VariantInfo,
} from "../parsers/gradle-output.js";

export class GradleAdapter {
  constructor(
    private runner: ProcessRunner = new ProcessRunner(),
    private projectPath?: string
  ) {}

  async build(
    operation: "assembleDebug" | "assembleRelease" | "bundle",
    module?: string,
    flavor?: string
  ): Promise<{ result: BuildResult; fullOutput: string }> {
    const task = module ? `${module}:${operation}` : operation;
    const args = [task];

    if (flavor) {
      args.push(`-Pflavor=${flavor}`);
    }

    const result = await this.gradle(args, 300000); // 5 min timeout for builds
    const parsed = parseBuildOutput(result.stdout + result.stderr);

    if (!parsed.success) {
      throw new ReplicantError(
        ErrorCode.BUILD_FAILED,
        `Build failed: ${parsed.failedTask || "unknown error"}`,
        "Check gradle-get-details for full error output",
        { buildResult: parsed }
      );
    }

    return { result: parsed, fullOutput: result.stdout + result.stderr };
  }

  async test(
    operation: "unitTest" | "connectedTest",
    module?: string,
    filter?: string
  ): Promise<{ result: TestResult; fullOutput: string }> {
    const taskName = operation === "unitTest" ? "testDebugUnitTest" : "connectedDebugAndroidTest";
    const task = module ? `${module}:${taskName}` : taskName;
    const args = [task];

    if (filter) {
      args.push("--tests", filter);
    }

    const result = await this.gradle(args, 600000); // 10 min timeout for tests
    const parsed = parseTestOutput(result.stdout + result.stderr);

    return { result: parsed, fullOutput: result.stdout + result.stderr };
  }

  async listModules(): Promise<string[]> {
    const result = await this.gradle(["projects"]);
    return parseModuleList(result.stdout);
  }

  async listVariants(module?: string): Promise<VariantInfo[]> {
    // Try to get variants - this varies by project setup
    const task = module ? `${module}:printVariants` : "printVariants";
    try {
      const result = await this.gradle([task]);
      return parseVariantList(result.stdout);
    } catch {
      // Fallback: return common defaults
      return [
        { name: "debug", buildType: "debug", flavors: [] },
        { name: "release", buildType: "release", flavors: [] },
      ];
    }
  }

  async listTasks(module?: string): Promise<string[]> {
    const args = module ? [`${module}:tasks`, "--all"] : ["tasks", "--all"];
    const result = await this.gradle(args);
    return parseTaskList(result.stdout);
  }

  async clean(stopDaemons = false): Promise<void> {
    await this.gradle(["clean"]);
    if (stopDaemons) {
      await this.gradle(["--stop"]);
    }
  }

  private async gradle(
    args: string[],
    timeoutMs = 120000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const gradleCmd = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

    try {
      return await this.runner.run(gradleCmd, args, {
        timeoutMs,
        cwd: this.projectPath,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new ReplicantError(
          ErrorCode.GRADLE_NOT_FOUND,
          "Gradle wrapper not found",
          "Ensure you are in an Android project directory with gradlew"
        );
      }
      throw error;
    }
  }
}
```

**Step 6: Commit**

```bash
git add src/adapters/gradle.ts src/parsers/gradle-output.ts tests/adapters/gradle.test.ts
git commit -m "feat: add Gradle adapter with build, test, and introspection"
```

---

### Task 10: UI Automator Adapter

**Files:**
- Create: `src/adapters/ui-automator.ts`
- Create: `src/parsers/ui-dump.ts`
- Create: `tests/adapters/ui-automator.test.ts`

**Step 1: Write failing tests for UI dump parsing**

Create `tests/adapters/ui-automator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseUiDump, AccessibilityNode } from "../src/parsers/ui-dump.js";

describe("UI Dump Parsing", () => {
  it("parses simple UI hierarchy", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
    <node index="0" text="Hello" resource-id="com.example:id/text" class="android.widget.TextView" bounds="[100,200][300,250]" />
    <node index="1" text="" resource-id="com.example:id/button" class="android.widget.Button" bounds="[100,300][300,350]">
      <node index="0" text="Click Me" class="android.widget.TextView" bounds="[120,310][280,340]" />
    </node>
  </node>
</hierarchy>`;

    const tree = parseUiDump(xml);
    expect(tree).toHaveLength(1);
    expect(tree[0].className).toBe("android.widget.FrameLayout");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children![0].text).toBe("Hello");
    expect(tree[0].children![0].resourceId).toBe("com.example:id/text");
  });

  it("extracts bounds as coordinates", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy>
  <node bounds="[100,200][300,400]" class="android.widget.Button" />
</hierarchy>`;

    const tree = parseUiDump(xml);
    expect(tree[0].bounds).toEqual({ left: 100, top: 200, right: 300, bottom: 400 });
    expect(tree[0].centerX).toBe(200);
    expect(tree[0].centerY).toBe(300);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/adapters/ui-automator.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement UI dump parser**

Create `src/parsers/ui-dump.ts`:

```typescript
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface AccessibilityNode {
  index: number;
  text: string;
  resourceId: string;
  className: string;
  contentDesc: string;
  bounds: Bounds;
  centerX: number;
  centerY: number;
  clickable: boolean;
  focusable: boolean;
  children?: AccessibilityNode[];
}

export function parseUiDump(xml: string): AccessibilityNode[] {
  // Simple XML parsing without external dependencies
  const nodes: AccessibilityNode[] = [];
  const nodeRegex = /<node([^>]*)(?:\/>|>([\s\S]*?)<\/node>)/g;

  function parseAttributes(attrStr: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+(?:-\w+)?)="([^"]*)"/g;
    let match;
    while ((match = attrRegex.exec(attrStr)) !== null) {
      attrs[match[1]] = match[2];
    }
    return attrs;
  }

  function parseBounds(boundsStr: string): Bounds {
    const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!match) return { left: 0, top: 0, right: 0, bottom: 0 };
    return {
      left: parseInt(match[1], 10),
      top: parseInt(match[2], 10),
      right: parseInt(match[3], 10),
      bottom: parseInt(match[4], 10),
    };
  }

  function parseNode(nodeXml: string): AccessibilityNode | null {
    const attrMatch = nodeXml.match(/<node([^>]*)/);
    if (!attrMatch) return null;

    const attrs = parseAttributes(attrMatch[1]);
    const bounds = parseBounds(attrs.bounds || "[0,0][0,0]");

    const node: AccessibilityNode = {
      index: parseInt(attrs.index || "0", 10),
      text: attrs.text || "",
      resourceId: attrs["resource-id"] || "",
      className: attrs.class || "",
      contentDesc: attrs["content-desc"] || "",
      bounds,
      centerX: Math.round((bounds.left + bounds.right) / 2),
      centerY: Math.round((bounds.top + bounds.bottom) / 2),
      clickable: attrs.clickable === "true",
      focusable: attrs.focusable === "true",
    };

    // Parse children recursively
    const innerMatch = nodeXml.match(/<node[^>]*>([\s\S]*)<\/node>/);
    if (innerMatch) {
      const children: AccessibilityNode[] = [];
      let match;
      const childRegex = /<node([^>]*)(?:\/>|>([\s\S]*?)<\/node>)/g;

      // Need to handle nested nodes carefully
      const inner = innerMatch[1];
      let depth = 0;
      let start = 0;

      for (let i = 0; i < inner.length; i++) {
        if (inner.slice(i, i + 5) === "<node") {
          if (depth === 0) start = i;
          depth++;
        } else if (inner.slice(i, i + 7) === "</node>" || inner.slice(i, i + 2) === "/>") {
          if (inner.slice(i, i + 2) === "/>") {
            if (depth === 1) {
              const childXml = inner.slice(start, i + 2);
              const child = parseNode(childXml);
              if (child) children.push(child);
            }
            depth = Math.max(0, depth - 1);
          } else if (inner.slice(i, i + 7) === "</node>") {
            depth--;
            if (depth === 0) {
              const childXml = inner.slice(start, i + 7);
              const child = parseNode(childXml);
              if (child) children.push(child);
            }
          }
        }
      }

      if (children.length > 0) {
        node.children = children;
      }
    }

    return node;
  }

  // Parse top-level hierarchy
  const hierarchyMatch = xml.match(/<hierarchy[^>]*>([\s\S]*)<\/hierarchy>/);
  if (hierarchyMatch) {
    const topLevel = hierarchyMatch[1];
    const match = topLevel.match(/<node[\s\S]*$/);
    if (match) {
      const node = parseNode(match[0]);
      if (node) nodes.push(node);
    }
  }

  return nodes;
}

export function flattenTree(nodes: AccessibilityNode[]): AccessibilityNode[] {
  const flat: AccessibilityNode[] = [];

  function walk(node: AccessibilityNode) {
    flat.push(node);
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const node of nodes) {
    walk(node);
  }

  return flat;
}

export function findElements(
  nodes: AccessibilityNode[],
  selector: {
    resourceId?: string;
    text?: string;
    textContains?: string;
    className?: string;
  }
): AccessibilityNode[] {
  const flat = flattenTree(nodes);

  return flat.filter((node) => {
    if (selector.resourceId && !node.resourceId.includes(selector.resourceId)) {
      return false;
    }
    if (selector.text && node.text !== selector.text) {
      return false;
    }
    if (selector.textContains && !node.text.includes(selector.textContains)) {
      return false;
    }
    if (selector.className && !node.className.includes(selector.className)) {
      return false;
    }
    return true;
  });
}
```

**Step 4: Run tests**

```bash
npm test -- tests/adapters/ui-automator.test.ts
```

Expected: All tests PASS

**Step 5: Implement UI Automator Adapter**

Create `src/adapters/ui-automator.ts`:

```typescript
import { AdbAdapter } from "./adb.js";
import { parseUiDump, findElements, flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";

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

  async screenshot(deviceId: string, localPath: string): Promise<void> {
    const remotePath = "/sdcard/screenshot.png";
    await this.adb.shell(deviceId, `screencap -p ${remotePath}`);

    // Pull to local (using adb pull via shell workaround)
    // In real implementation, would use adb pull directly
    const result = await this.adb.shell(deviceId, `base64 ${remotePath}`);

    // For now, just verify it worked
    await this.adb.shell(deviceId, `rm ${remotePath}`);
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

**Step 6: Commit**

```bash
git add src/adapters/ui-automator.ts src/parsers/ui-dump.ts tests/adapters/ui-automator.test.ts
git commit -m "feat: add UI Automator adapter with accessibility tree parsing"
```

---

### Task 11: Adapters and Parsers Index

**Files:**
- Create: `src/adapters/index.ts`
- Create: `src/parsers/index.ts`

**Step 1: Create adapters barrel**

```typescript
export { AdbAdapter } from "./adb.js";
export { EmulatorAdapter, type EmulatorListResult } from "./emulator.js";
export { GradleAdapter } from "./gradle.js";
export { UiAutomatorAdapter } from "./ui-automator.js";
```

**Step 2: Create parsers barrel**

```typescript
export * from "./adb-output.js";
export * from "./emulator-output.js";
export * from "./gradle-output.js";
export * from "./ui-dump.js";
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/adapters/index.ts src/parsers/index.ts
git commit -m "chore: add adapters and parsers barrel exports"
```

---

## Phase 3: MCP Tools

### Task 12: MCP Server Setup

**Files:**
- Modify: `src/index.ts`
- Create: `src/server.ts`

**Step 1: Implement MCP server**

Create `src/server.ts`:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CacheManager, DeviceStateManager, ProcessRunner } from "./services/index.js";
import { AdbAdapter, EmulatorAdapter, GradleAdapter, UiAutomatorAdapter } from "./adapters/index.js";

export interface ServerContext {
  cache: CacheManager;
  deviceState: DeviceStateManager;
  processRunner: ProcessRunner;
  adb: AdbAdapter;
  emulator: EmulatorAdapter;
  gradle: GradleAdapter;
  ui: UiAutomatorAdapter;
}

export function createServerContext(): ServerContext {
  const processRunner = new ProcessRunner();
  const adb = new AdbAdapter(processRunner);

  return {
    cache: new CacheManager(),
    deviceState: new DeviceStateManager(),
    processRunner,
    adb,
    emulator: new EmulatorAdapter(processRunner),
    gradle: new GradleAdapter(processRunner),
    ui: new UiAutomatorAdapter(adb),
  };
}

export async function createServer(context: ServerContext): Promise<Server> {
  const server = new Server(
    {
      name: "replicant-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Tool handlers will be registered here in subsequent tasks

  return server;
}

export async function runServer(): Promise<void> {
  const context = createServerContext();
  const server = await createServer(context);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

**Step 2: Update src/index.ts**

```typescript
#!/usr/bin/env node
import { runServer } from "./server.js";

runServer().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/server.ts src/index.ts
git commit -m "feat: add MCP server foundation with context injection"
```

---

### Task 13: Cache Tool

**Files:**
- Create: `src/tools/cache.ts`
- Create: `tests/tools/cache.test.ts`

**Step 1: Write failing test**

Create `tests/tools/cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { handleCacheTool } from "../src/tools/cache.js";
import { CacheManager } from "../src/services/index.js";

describe("cache tool", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager();
  });

  it("returns stats", async () => {
    cache.set("test-1", { data: 1 }, "test");
    const result = await handleCacheTool({ operation: "get-stats" }, cache);
    expect(result.stats.entryCount).toBe(1);
  });

  it("clears specific key", async () => {
    cache.set("test-1", { data: 1 }, "test");
    await handleCacheTool({ operation: "clear", key: "test-1" }, cache);
    expect(cache.get("test-1")).toBeUndefined();
  });

  it("clears all", async () => {
    cache.set("test-1", { data: 1 }, "test");
    cache.set("test-2", { data: 2 }, "test");
    await handleCacheTool({ operation: "clear" }, cache);
    expect(cache.getStats().entryCount).toBe(0);
  });

  it("gets config", async () => {
    const result = await handleCacheTool({ operation: "get-config" }, cache);
    expect(result.config.maxEntries).toBeDefined();
  });

  it("sets config", async () => {
    await handleCacheTool({ operation: "set-config", config: { maxEntries: 50 } }, cache);
    expect(cache.getConfig().maxEntries).toBe(50);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/tools/cache.test.ts
```

**Step 3: Implement cache tool**

Create `src/tools/cache.ts`:

```typescript
import { z } from "zod";
import { CacheManager } from "../services/index.js";

export const cacheInputSchema = z.object({
  operation: z.enum(["get-stats", "clear", "get-config", "set-config"]),
  key: z.string().optional(),
  config: z.object({
    maxEntries: z.number().optional(),
    maxEntrySizeBytes: z.number().optional(),
    defaultTtlMs: z.number().optional(),
  }).optional(),
});

export type CacheInput = z.infer<typeof cacheInputSchema>;

export async function handleCacheTool(
  input: CacheInput,
  cache: CacheManager
): Promise<Record<string, unknown>> {
  switch (input.operation) {
    case "get-stats":
      return { stats: cache.getStats() };

    case "clear":
      if (input.key) {
        cache.clear(input.key);
        return { cleared: input.key };
      } else {
        cache.clearAll();
        return { cleared: "all" };
      }

    case "get-config":
      return { config: cache.getConfig() };

    case "set-config":
      if (input.config) {
        cache.setConfig(input.config);
      }
      return { config: cache.getConfig() };

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const cacheToolDefinition = {
  name: "cache",
  description: "Manage the cache. Operations: get-stats, clear, get-config, set-config. See rtfm for details.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["get-stats", "clear", "get-config", "set-config"],
      },
      key: { type: "string", description: "Specific cache key to clear" },
      config: {
        type: "object",
        properties: {
          maxEntries: { type: "number" },
          maxEntrySizeBytes: { type: "number" },
          defaultTtlMs: { type: "number" },
        },
      },
    },
    required: ["operation"],
  },
};
```

**Step 4: Run tests**

```bash
npm test -- tests/tools/cache.test.ts
```

**Step 5: Commit**

```bash
git add src/tools/cache.ts tests/tools/cache.test.ts
git commit -m "feat: add cache tool"
```

---

### Task 14: RTFM Tool

**Files:**
- Create: `src/tools/rtfm.ts`
- Create: `docs/rtfm/index.md`
- Create: `docs/rtfm/build.md`
- Create: `docs/rtfm/adb.md`
- Create: `docs/rtfm/emulator.md`
- Create: `docs/rtfm/ui.md`

**Step 1: Create RTFM documentation files**

Create `docs/rtfm/index.md`:

```markdown
# replicant-mcp Documentation

## Categories

- **build** - Gradle build and test tools
- **adb** - Android Debug Bridge tools
- **emulator** - Emulator management tools
- **ui** - UI automation tools
- **cache** - Cache management
```

Create `docs/rtfm/build.md`:

```markdown
# Build Tools

## gradle-build

Build an Android application.

**Operations:**
- `assembleDebug` - Build debug APK
- `assembleRelease` - Build release APK
- `bundle` - Build Android App Bundle

**Parameters:**
- `operation` (required): Build operation
- `module`: Module path (e.g., ":app", ":feature:login")
- `flavor`: Product flavor name

**Returns:** `{ buildId, summary: { success, duration, apkSize, warnings } }`

**Example:**
```json
{ "operation": "assembleDebug", "module": ":app" }
```

## gradle-test

Run tests.

**Operations:**
- `unitTest` - Run unit tests
- `connectedTest` - Run instrumented tests on device

**Parameters:**
- `operation` (required): Test type
- `module`: Module path
- `filter`: Test filter (e.g., "com.example.MyTest", "*LoginTest*")

## gradle-list

Introspect project structure.

**Operations:**
- `variants` - List build variants
- `modules` - List project modules
- `tasks` - List Gradle tasks

## gradle-get-details

Fetch full output for a previous build/test.

**Parameters:**
- `id` (required): Build or test ID from previous operation
- `detailType`: "logs" | "errors" | "tasks"
```

Create `docs/rtfm/adb.md`:

```markdown
# ADB Tools

## adb-device

Manage device connections.

**Operations:**
- `list` - List connected devices
- `select` - Select active device
- `wait` - Wait for device to connect
- `properties` - Get device properties

## adb-app

Manage applications.

**Operations:**
- `install` - Install APK
- `uninstall` - Uninstall package
- `launch` - Launch app
- `stop` - Force stop app
- `clear-data` - Clear app data

## adb-logcat

Read device logs.

**Structured mode:**
- `package`: Filter to app's PID
- `tags`: Array of log tags
- `level`: "verbose" | "debug" | "info" | "warn" | "error"

**Raw mode:**
- `rawFilter`: Full logcat filter string (e.g., "ActivityManager:I MyApp:D *:S")

**Common:**
- `lines`: Number of lines (default: 100)
- `since`: Time filter ("5m" or ISO timestamp)

## adb-shell

Execute shell commands with safety guards.

**Parameters:**
- `command` (required): Shell command
- `timeout`: Max execution time (default: 30s, max: 120s)

**Blocked commands:** rm -rf /, reboot, shutdown, su, sudo
```

Create `docs/rtfm/emulator.md`:

```markdown
# Emulator Tools

## emulator-device

Manage Android emulators.

**Operations:**
- `list` - List available and running emulators
- `create` - Create new AVD
- `start` - Start emulator
- `kill` - Stop running emulator
- `wipe` - Reset emulator data
- `snapshot-save` - Save snapshot
- `snapshot-load` - Load snapshot
- `snapshot-list` - List snapshots
- `snapshot-delete` - Delete snapshot

**Parameters:**
- `operation` (required): Operation to perform
- `avdName`: AVD name (for create/start/wipe)
- `device`: Device profile (for create, e.g., "pixel_7")
- `systemImage`: System image (for create)
- `snapshotName`: Snapshot name (for snapshot operations)
```

Create `docs/rtfm/ui.md`:

```markdown
# UI Automation Tools

## ui

Interact with app UI via accessibility tree.

**Operations:**
- `dump` - Get full accessibility tree
- `find` - Find elements by selector
- `tap` - Tap at coordinates
- `input` - Enter text
- `screenshot` - Capture screen
- `accessibility-check` - Quick accessibility assessment

**Selectors (for find):**
- `resourceId`: Match resource ID (partial)
- `text`: Match exact text
- `textContains`: Match partial text
- `className`: Match class name

**Example - Find and tap:**
```json
{ "operation": "find", "selector": { "text": "Login" } }
// Returns: { elements: [{ index: 0, centerX: 540, centerY: 1200, ... }] }

{ "operation": "tap", "x": 540, "y": 1200 }
// Or use elementIndex from previous find
{ "operation": "tap", "elementIndex": 0 }
```
```

**Step 2: Implement RTFM tool**

Create `src/tools/rtfm.ts`:

```typescript
import { z } from "zod";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RTFM_DIR = join(__dirname, "../../docs/rtfm");

export const rtfmInputSchema = z.object({
  category: z.string().optional(),
  tool: z.string().optional(),
});

export type RtfmInput = z.infer<typeof rtfmInputSchema>;

export async function handleRtfmTool(input: RtfmInput): Promise<{ content: string }> {
  if (!input.category && !input.tool) {
    // Return index
    const content = await readFile(join(RTFM_DIR, "index.md"), "utf-8");
    return { content };
  }

  if (input.category) {
    const content = await readFile(join(RTFM_DIR, `${input.category}.md`), "utf-8");
    return { content };
  }

  if (input.tool) {
    // Map tool to category
    const toolToCategory: Record<string, string> = {
      "gradle-build": "build",
      "gradle-test": "build",
      "gradle-list": "build",
      "gradle-get-details": "build",
      "adb-device": "adb",
      "adb-app": "adb",
      "adb-logcat": "adb",
      "adb-shell": "adb",
      "emulator-device": "emulator",
      "ui": "ui",
      "cache": "build", // or create cache.md
      "rtfm": "build",
    };

    const category = toolToCategory[input.tool] || "index";
    const content = await readFile(join(RTFM_DIR, `${category}.md`), "utf-8");

    // Try to extract just the relevant section
    const toolSection = extractToolSection(content, input.tool);
    return { content: toolSection || content };
  }

  return { content: "No documentation found." };
}

function extractToolSection(content: string, toolName: string): string | null {
  const regex = new RegExp(`## ${toolName}[\\s\\S]*?(?=## |$)`, "i");
  const match = content.match(regex);
  return match ? match[0].trim() : null;
}

export const rtfmToolDefinition = {
  name: "rtfm",
  description: "Get documentation. Pass category or tool name.",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", description: "Category: build, adb, emulator, ui" },
      tool: { type: "string", description: "Tool name for specific docs" },
    },
  },
};
```

**Step 3: Commit**

```bash
git add src/tools/rtfm.ts docs/rtfm/
git commit -m "feat: add RTFM tool with documentation"
```

---

### Task 15-23: Remaining Tools

Due to length, I'll provide abbreviated task structures for the remaining tools. Each follows the same pattern:

1. Write failing test
2. Run test
3. Implement tool
4. Run test
5. Commit

**Task 15: adb-device tool**
**Task 16: adb-app tool**
**Task 17: adb-logcat tool**
**Task 18: adb-shell tool**
**Task 19: emulator-device tool**
**Task 20: gradle-build tool**
**Task 21: gradle-test tool**
**Task 22: gradle-list tool**
**Task 23: gradle-get-details tool**
**Task 24: ui tool**

Each tool follows this pattern in `src/tools/<name>.ts`:

```typescript
import { z } from "zod";
import { ServerContext } from "../server.js";

export const <name>InputSchema = z.object({ /* ... */ });
export type <Name>Input = z.infer<typeof <name>InputSchema>;

export async function handle<Name>Tool(
  input: <Name>Input,
  context: ServerContext
): Promise<Record<string, unknown>> {
  // Implementation using context.adb, context.cache, etc.
}

export const <name>ToolDefinition = {
  name: "<name>",
  description: "...",
  inputSchema: { /* JSON Schema */ },
};
```

---

### Task 25: Register All Tools

**Files:**
- Create: `src/tools/index.ts`
- Modify: `src/server.ts`

**Step 1: Create tools barrel**

```typescript
export * from "./cache.js";
export * from "./rtfm.js";
export * from "./adb-device.js";
export * from "./adb-app.js";
export * from "./adb-logcat.js";
export * from "./adb-shell.js";
export * from "./emulator-device.js";
export * from "./gradle-build.js";
export * from "./gradle-test.js";
export * from "./gradle-list.js";
export * from "./gradle-get-details.js";
export * from "./ui.js";
```

**Step 2: Update server.ts to register tools**

Add tool registration in `createServer()`:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    cacheToolDefinition,
    rtfmToolDefinition,
    // ... all other tool definitions
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "cache":
      return { content: [{ type: "text", text: JSON.stringify(await handleCacheTool(args, context.cache)) }] };
    // ... all other tools
  }
});
```

**Step 3: Commit**

```bash
git add src/tools/index.ts src/server.ts
git commit -m "feat: register all MCP tools"
```

---

## Phase 4: Polish

### Task 26: CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

```markdown
# replicant-mcp

Android MCP server for AI-assisted Android development.

## Quick Start

```bash
npm install
npm run build
npm start
```

## Tool Categories

- **gradle-*** - Build and test Android apps
- **emulator-device** - Manage Android emulators
- **adb-*** - Device and app control
- **ui** - Accessibility-first UI automation
- **cache** - Manage response cache
- **rtfm** - On-demand documentation

## Key Patterns

1. **Progressive Disclosure**: Tools return summaries with cache IDs. Use `*-get-details` for full output.
2. **Single Device Focus**: Use `adb-device list` then `adb-device select` to choose active device.
3. **Accessibility-First**: Prefer `ui dump` over screenshots for UI interaction.

## Common Workflows

**Build and install:**
```
gradle-list { operation: "variants" }
gradle-build { operation: "assembleDebug" }
adb-app { operation: "install", apkPath: "..." }
```

**Debug crash:**
```
adb-logcat { package: "com.example", level: "error", lines: 50 }
```

**UI automation:**
```
ui { operation: "dump" }
ui { operation: "find", selector: { text: "Login" } }
ui { operation: "tap", elementIndex: 0 }
```
```

**Step 1: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with usage guide"
```

---

### Task 27: Final README

**Files:**
- Create: `README.md`

Create comprehensive README with installation, configuration, and examples.

**Commit:**

```bash
git add README.md
git commit -m "docs: add README with installation and usage"
```

---

### Task 28: Package.json Finalization

Update package.json with:
- bin entry for CLI
- repository, author, license fields
- keywords

**Commit:**

```bash
git add package.json
git commit -m "chore: finalize package.json for publishing"
```

---

## Summary

**Total Tasks:** 28
**Phases:** 4 (Foundation → Adapters → Tools → Polish)

**Test Commands:**
```bash
npm test              # Run all tests
npm run build         # Build TypeScript
npm start             # Run server
```

**After completing all tasks, the server should pass this integration test:**

```bash
# Build app
echo '{"method":"tools/call","params":{"name":"gradle-build","arguments":{"operation":"assembleDebug"}}}' | node dist/index.js

# List devices
echo '{"method":"tools/call","params":{"name":"adb-device","arguments":{"operation":"list"}}}' | node dist/index.js
```
