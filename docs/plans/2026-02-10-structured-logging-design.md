# Structured Logging Design

**Issue:** `replicant-mcp-8l0`
**Branch:** `feature/structured-logging`
**Wave:** 2

## Constraint: MCP stdio

replicant-mcp is an MCP server using `StdioServerTransport` (`src/server.ts:197`). Stdout is reserved for MCP protocol. **All diagnostic logging MUST go to `process.stderr`.**

## Logger API

Create `src/utils/logger.ts`:

```typescript
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.REPLICANT_LOG_LEVEL as LogLevel) || "warn";
const useJson = process.env.REPLICANT_LOG_FORMAT === "json";

export const logger = {
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
};

function log(level: LogLevel, msg: string, ctx?: Record<string, unknown>) {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) return;
  if (useJson) {
    process.stderr.write(JSON.stringify({ level, msg, ts: new Date().toISOString(), ...ctx }) + "\n");
  } else {
    process.stderr.write(`[${level.toUpperCase()}] ${msg}\n`);
  }
}
```

## Environment Variables

| Variable | Values | Default |
|----------|--------|---------|
| `REPLICANT_LOG_LEVEL` | `error`, `warn`, `info`, `debug` | `warn` |
| `REPLICANT_LOG_FORMAT` | `text`, `json` | `text` |

## Files to Convert

Only 3 source files use `console.*` for diagnostic logging (not user-facing CLI output):

| File | Line(s) | Current | New |
|------|---------|---------|-----|
| `src/index.ts` | 5 | `console.error("Server error:", error)` | `logger.error("Server error", { error })` |
| `src/services/config.ts` | 18 | `console.warn("REPLICANT_CONFIG set but...")` | `logger.warn("REPLICANT_CONFIG set but...")` |
| `src/services/config.ts` | 37 | `console.warn("Failed to parse...")` | `logger.warn("Failed to parse...", { error: message })` |

## What NOT to Change

`src/cli/*.ts` files (adb.ts, cache.ts, emulator.ts, gradle.ts, ui.ts) use `console.log` for **user-facing CLI output**. These are NOT diagnostic logs — they print results to the terminal. Leave them unchanged.

## Design Note: Module-Level State

The logger uses module-level `const` for level and format. CLAUDE.md says "no module-level mutable state." This is acceptable because:
- The values are `const` (read once from env at startup, never mutated)
- A logger is inherently global — threading it through ServerContext would require passing it to every function
- This is configuration, not runtime state

## Tests

`tests/utils/logger.test.ts`:
- Default level (warn) filters out info/debug
- `REPLICANT_LOG_LEVEL=debug` enables all levels
- `REPLICANT_LOG_FORMAT=json` outputs valid JSON to stderr
- Text format outputs `[LEVEL] message` to stderr
- Context object is included in JSON output
- No output goes to stdout

## Pre-PR

- `npm run test:coverage` — all 4 thresholds must pass
- `npm run check-complexity`
