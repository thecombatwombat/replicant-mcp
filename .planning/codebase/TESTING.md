# Testing Patterns

**Analysis Date:** 2026-03-25

## Test Framework

**Runner:**
- Vitest 4.0.17 with Node environment
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in expect API (Jest-compatible)

**Run Commands:**
```bash
npm run test              # Watch mode
npm run test:unit        # Unit tests only (services, adapters, tools)
npm run test:integration # Integration tests only
npm test -- --run        # Single run (all tests)
npm run test:coverage    # Coverage report (default: off, enabled with flag)
```

## Test File Organization

**Location:**
- Co-located alongside implementation: `tests/<category>/` mirrors `src/<category>/`
- Structure: `tests/services/`, `tests/adapters/`, `tests/tools/`, `tests/integration/`, `tests/fixtures/`
- One test file per module: `cache-manager.ts` → `cache-manager.test.ts`

**Naming:**
- Pattern: `<module>.test.ts`
- Examples: `cache.test.ts`, `adb.test.ts`, `process-runner.test.ts`, `errors.test.ts`

**Structure:**
```
tests/
├── services/
│   ├── cache-manager.test.ts
│   ├── process-runner.test.ts
│   ├── device-state.test.ts
│   └── environment.test.ts
├── adapters/
│   ├── adb.test.ts
│   ├── ui-automator.test.ts
│   └── emulator.test.ts
├── tools/
│   ├── cache.test.ts
│   ├── adb-shell.test.ts
│   └── ui-*.test.ts
├── integration/
│   ├── just-works-ux.test.ts
│   └── icon-recognition.test.ts
├── fixtures/
│   └── contracts/
└── types/
    └── errors.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("ProcessRunner", () => {
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
  });

  describe("safety guards", () => {
    it("blocks dangerous commands", async () => {
      await expect(runner.run("rm", ["-rf", "/"])).rejects.toThrow(
        "is not allowed"
      );
    });
  });
});
```

**Patterns:**
- Top-level `describe("ClassName" or "module name")` block
- Nested `describe()` for operation grouping
- Each `it()` tests one assertion or behavior
- Use `beforeEach()` for shared setup
- Use `afterEach()` for cleanup (env vars, state reset)

**Async Testing Pattern:**
```typescript
it("resolves with data", async () => {
  const result = await cache.get("key-1");
  expect(result).toBeDefined();
});

it("rejects with specific error", async () => {
  await expect(runner.run("bad-command")).rejects.toThrow("is not allowed");
});
```

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**
```typescript
import { vi } from "vitest";

// Mock a method
const mockAdb = {
  getDevices: vi.fn().mockResolvedValue([
    { id: "emulator-5554", type: "emulator", name: "test", status: "online" }
  ]),
};

// Verify mock was called
expect(mockAdb.getDevices).toHaveBeenCalledTimes(1);
expect(mockAdb.getDevices).toHaveBeenCalledWith("device-1");

// Spy on existing function
const spyFn = vi.spyOn(obj, "method");
// ... test code ...
expect(spyFn).toHaveBeenCalled();
```

**What to Mock:**
- External dependencies: adb adapter, emulator, gradle
- Process execution: ProcessRunner for file system/command safety
- Environment variables: use beforeEach/afterEach to restore original

**What NOT to Mock:**
- Core classes being tested (test the real implementation)
- Zod schemas (validate real input parsing)
- Error classes (test error creation and properties)
- Logger utility (it's side-effect; verify logs with spies if needed)

**Example from `tests/integration/just-works-ux.test.ts`:**
```typescript
it("auto-selects single device without explicit list call", async () => {
  const manager = new DeviceStateManager();
  const mockAdb = {
    getDevices: vi.fn().mockResolvedValue([
      { id: "emulator-5554", type: "emulator", name: "test", status: "online" }
    ]),
  };

  const device = await manager.ensureDevice(mockAdb as any);

  expect(device.id).toBe("emulator-5554");
  expect(mockAdb.getDevices).toHaveBeenCalledTimes(1);
});
```

## Fixtures and Factories

**Test Data:**
- No factory functions defined in codebase
- Test data created inline in test blocks
- For larger datasets, define in test file as constants

**Example from `tests/adapters/adb.test.ts`:**
```typescript
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
});
```

**Location:**
- Fixture contracts stored in `tests/fixtures/contracts/` (JSON format)
- Test helper constants defined in test file itself
- Environment mocks managed with `beforeEach`/`afterEach`

**Pattern for Environment Fixtures:**
```typescript
let originalEnv: string | undefined;

beforeEach(() => {
  originalEnv = process.env.ANDROID_HOME;
});

afterEach(() => {
  if (originalEnv !== undefined) {
    process.env.ANDROID_HOME = originalEnv;
  } else {
    delete process.env.ANDROID_HOME;
  }
});

it("caches detection results", async () => {
  process.env.ANDROID_HOME = "/fake/path";
  // test code
});
```

## Coverage

**Requirements:**
- Lines: 68%
- Branches: 60%
- Functions: 60%
- Statements: 67%
- Per-file thresholds: disabled

**Exclusions from coverage:**
- `src/**/index.ts` (barrel exports)
- `src/types/**` (type definitions)
- `src/cli/**` (thin CLI wrappers)
- `**/*.d.ts` (declarations)

**View Coverage:**
```bash
npm run test:coverage
# Generates: ./coverage/index.html (open in browser)
```

**Config Location:** `vitest.config.ts` lines 8-28

## Test Types

**Unit Tests:**
- Location: `tests/services/`, `tests/adapters/`, `tests/tools/`
- Scope: Individual class/function in isolation
- Mocking: External dependencies (adb, process runner)
- Coverage: Happy paths, error cases, edge cases, boundaries

**Examples:**
- `tests/services/cache-manager.test.ts`: CacheManager class operations
- `tests/adapters/adb.test.ts`: Parsing logic and adapter methods
- `tests/tools/cache.test.ts`: Tool handler with mocked cache

**Integration Tests:**
- Location: `tests/integration/`
- Scope: Multiple components working together
- Example: `just-works-ux.test.ts` tests device selection flow across DeviceStateManager → AdbAdapter

**E2E Tests:**
- Framework: Not formally set up
- Real device testing: `npm run test:device` (runs `scripts/real-device-test.ts`)

## Common Patterns

**Async Testing:**
```typescript
it("executes a simple command and returns output", async () => {
  const result = await runner.run("echo", ["hello"]);
  expect(result.stdout.trim()).toBe("hello");
  expect(result.exitCode).toBe(0);
});

it("times out long-running commands", async () => {
  await expect(
    runner.run("sleep", ["10"], { timeoutMs: 100 })
  ).rejects.toThrow("timed out");
});
```

**Error Testing:**
```typescript
it("throws helpful error with no devices", async () => {
  const manager = new DeviceStateManager();
  const mockAdb = {
    getDevices: vi.fn().mockResolvedValue([]),
  };

  await expect(manager.ensureDevice(mockAdb as any)).rejects.toMatchObject({
    code: "NO_DEVICES",
    suggestion: expect.stringContaining("emulator"),
  });
});

it("includes suggestion in JSON output", () => {
  const error = new ReplicantError(
    ErrorCode.SDK_NOT_FOUND,
    "Android SDK not found",
    "Install Android Studio or set ANDROID_HOME"
  );

  const json = error.toJSON();

  expect(json.error).toBe("SDK_NOT_FOUND");
  expect(json.suggestion).toBe("Install Android Studio or set ANDROID_HOME");
});
```

**Boundary Testing:**
```typescript
it("allows timeouts up to 600s without clamping", async () => {
  const result = await runner.run("echo", ["ok"], { timeoutMs: 300_000 });
  expect(result.stdout.trim()).toBe("ok");
});

it("clamps timeouts above 600s to max", async () => {
  const result = await runner.run("echo", ["ok"], { timeoutMs: 999_999 });
  expect(result.stdout.trim()).toBe("ok");
});
```

## Test Before Implementation

**Project Standard:** Tests written before code (TDD approach)

**Pattern:**
1. Write test that describes desired behavior
2. Test fails (red phase)
3. Write implementation (green phase)
4. Refactor for clarity (blue phase)

**Coverage Enforcement:**
```bash
npm run test:coverage    # Enforced before merge via prepublishOnly hook
npm run validate         # Runs build, lint, complexity, and tests
```

## Snapshot Testing

- Not used in this codebase
- Contracts stored in `tests/fixtures/contracts/` as explicit JSON

---

*Testing analysis: 2026-03-25*
