# Coding Conventions

**Analysis Date:** 2026-03-25

## Naming Patterns

**Files:**
- Lowercase with hyphens for multi-word names: `ui-query.ts`, `process-runner.ts`, `adb-device.ts`
- Test files: `*.test.ts` suffix (e.g., `cache.test.ts`)
- Index files: `index.ts` for barrel exports
- Type definition files: `errors.ts`, `config.ts`, `device.ts`
- Service/utility files: descriptive lowercase (e.g., `logger.ts`, `paths.ts`)

**Functions:**
- camelCase: `handleCacheTool()`, `parseDeviceList()`, `generateId()`
- Handler functions prefixed with `handle`: `handleDump()`, `handleSelect()`, `handleList()`
- Private/internal functions: camelCase with underscore prefix optional: `safeStringify()`, `log()`
- Parser functions prefixed with `parse`: `parseDeviceList()`, `parsePackageList()`, `parseGradleOutput()`
- Factory/creator functions: `create*`: `createServerContext()`, `createServer()`

**Variables:**
- camelCase for all variables: `cache`, `deviceState`, `processRunner`, `currentLevel`
- Constants: UPPER_SNAKE_CASE: `LOG_LEVELS`, `CACHE_TTLS`, `DEFAULT_CONFIG`
- Type guards and predicates: optional `is` or `has` prefix
- Unused parameters: prefix with underscore: `_config`, `_env`

**Types:**
- PascalCase for classes and interfaces: `ServerContext`, `ReplicantError`, `CacheManager`, `ProcessRunner`
- PascalCase for type aliases: `LogLevel`, `ErrorCode`, `RunResult`
- Union types: PascalCase: `OperationHandler`, `ToolError`

## Code Style

**Formatting:**
- Tool: ESLint with TypeScript ESLint
- No Prettier explicitly configured, but ESLint handles formatting
- Line length: No explicit limit configured
- Indentation: 2 spaces (standard TypeScript)

**Linting:**
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- Unused variables caught with ESLint rule: `@typescript-eslint/no-unused-vars` with underscore pattern exception
- Explicit `any` allowed only in test files (`tests/**/*.ts`)
- No explicit `any` in source code

**Key Rules:**
- No destructuring or shadowing of unused parameters (use `_` prefix)
- TypeScript ES2022 target (`"target": "ES2022"`)
- Module system: ESM (`"type": "module"` in `package.json`)

## Import Organization

**Order:**
1. External packages (e.g., `import { z } from "zod"`)
2. Internal services/adapters (e.g., `import { ServerContext } from "../server.js"`)
3. Types (e.g., `import { ReplicantError, ErrorCode } from "../types/index.js"`)
4. Parsers/utilities (e.g., `import { parseDeviceList } from "../parsers/adb-output.js"`)

**Path Aliases:**
- Relative imports only (no path aliases configured)
- Always use explicit `.js` extension in imports for ESM compatibility
- Barrel exports via `index.ts` files: `src/types/index.ts`, `src/services/index.ts`, `src/adapters/index.ts`, `src/tools/index.ts`

**Example:**
```typescript
import { z } from "zod";
import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode } from "../types/index.js";
import { parseDeviceList } from "../parsers/adb-output.js";
```

## Error Handling

**Patterns:**
- Use custom `ReplicantError` class for all application errors
- Every error must have: `code` (ErrorCode enum), `message`, `suggestion` (optional), `context` (optional)
- Never throw generic `Error` for domain-level issues
- ErrorCode is a string literal union defined in `src/types/errors.ts`

**Pattern Examples:**
```typescript
// With suggestion
throw new ReplicantError(
  ErrorCode.DEVICE_NOT_FOUND,
  `Device ${input.deviceId} not found`,
  "Use adb-device list to see available devices"
);

// With context
throw new ReplicantError(
  ErrorCode.ADB_NOT_FOUND,
  "adb not found",
  "Check SDK installation",
  { checkedPaths: ["/usr/bin/adb", "/opt/android/adb"] }
);
```

**Exception Handling:**
- Catch external errors (ZodError, Node errors) and wrap in ReplicantError
- Always provide context and suggestion for user-facing errors
- Server handler converts ReplicantError to ToolError via `.toToolError()` method

## Logging

**Framework:** Custom `logger` object in `src/utils/logger.ts`

**Methods:**
- `logger.error(msg: string, ctx?: Record<string, unknown>)`
- `logger.warn(msg: string, ctx?: Record<string, unknown>)`
- `logger.info(msg: string, ctx?: Record<string, unknown>)`
- `logger.debug(msg: string, ctx?: Record<string, unknown>)`

**Configuration:**
- Level controlled by `REPLICANT_LOG_LEVEL` env var (default: "warn")
- Format controlled by `REPLICANT_LOG_FORMAT` env var ("json" or plain text)
- All output goes to stderr

**Pattern:**
```typescript
import { logger } from "../utils/logger.js";

logger.info("Starting process", { command: "adb devices" });
logger.error("Process failed", { exitCode: 1, stderr: "..." });
```

## Comments

**When to Comment:**
- Complex parsing logic: explain why the regex or algorithm works
- Non-obvious type decisions: why a particular shape
- Workarounds for external tool quirks: explain the constraint
- Public API behavior unclear from signature: explain the contract

**JSDoc/TSDoc:**
- Not required but used sparingly in critical functions
- Tool handlers may have comments for parameter documentation
- Barrel exports use named exports (comments added to index.ts as needed)

**Example:**
```typescript
// Regex matches "device-5554\tdevice" and "192.168.1.1:5555\toffline"
const devices = lines.map(line => parseLine(line));

/**
 * Runs a command with safety checks and timeout.
 * Never blocks the event loop with synchronous operations.
 */
export async function run(cmd: string, args: string[]): Promise<RunResult> {
```

## Function Design

**Size:**
- Soft limit: 80 lines per function (enforced in DECISIONS.md)
- CLI command builders in `src/cli/` are excluded from size limits
- Longer functions broken into private helpers

**Parameters:**
- Avoid optional parameters when boolean flags can be explicit
- Use object parameters for multiple related arguments
- Keep parameter count ≤ 4; use object destructuring for more

**Return Values:**
- Async functions always return `Promise<T>`
- Tool handlers return `Promise<Record<string, unknown>>` (serializable JSON)
- Void for side effects only (e.g., logger.error)

**Example:**
```typescript
// Good: explicit parameters, clear return type
async function handleDump(
  input: UiQueryInput,
  context: ServerContext,
  _config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  // implementation
}

// Good: object parameter for multiple options
async function run(
  cmd: string,
  args: string[],
  options?: { timeoutMs?: number; env?: Record<string, string> }
): Promise<RunResult> {
  // implementation
}
```

## Module Design

**Exports:**
- Named exports only (no default exports)
- One primary class/function per module
- Related utilities grouped in same module
- Types exported separately from implementations

**Barrel Files:**
- Centralized in `index.ts` files
- Type definitions exported via barrel for clean imports
- Example: `src/services/index.ts` exports ProcessRunner, CacheManager, etc.

**File Structure Example:**
```
src/
├── services/
│   ├── index.ts           # Barrel: export all
│   ├── cache-manager.ts   # CacheManager class
│   ├── process-runner.ts  # ProcessRunner class
│   └── device-state.ts    # DeviceStateManager class
├── tools/
│   ├── index.ts           # Barrel: export all tool handlers
│   ├── adb-device.ts      # Handler + input schema
│   └── ui-query.ts        # Handler + input schema
```

## Input Validation

**Pattern:**
- Every tool handler has a corresponding Zod schema
- Schema exports: `[toolName]InputSchema`, `[toolName]Input` type
- Validation happens in server dispatcher before handler receives args
- Invalid input throws ReplicantError with INPUT_VALIDATION_FAILED code

**Example from `src/tools/adb-device.ts`:**
```typescript
export const adbDeviceInputSchema = z.object({
  operation: z.enum(["list", "select", "wait", "properties", "health-check"]),
  deviceId: z.string().optional(),
});

export type AdbDeviceInput = z.infer<typeof adbDeviceInputSchema>;
```

---

*Convention analysis: 2026-03-25*
