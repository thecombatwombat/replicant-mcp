# Architecture

Design decisions and technical architecture for replicant-mcp.

## Tech Stack

- **TypeScript + Node.js** - Best MCP SDK ecosystem, direct pattern porting from xc-mcp
- **`@modelcontextprotocol/sdk`** - Standard MCP server implementation
- **`execa`** - Clean CLI process management

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-device support | Single device focus | Simpler state management; can add explicit `deviceId` later |
| Logcat filtering | Structured + raw | Simple presets for common cases, full syntax for power users |
| Caching strategy | Event-driven + TTL fallback | Invalidate on state changes, TTLs as safety net |
| Gradle daemon lifecycle | Automatic cleanup | `gradle-clean --stop-daemons` flag; agent doesn't manage daemons directly |
| Emulator snapshots | Edge case | Under `emulator-device` operations, not first-class tool |

## Tool Surface (12 tools)

All tools use `defer_loading: true` for zero startup overhead.

### Build & Test

```typescript
gradle-build({
  operation: "assembleDebug" | "assembleRelease" | "bundle",
  module?: string,
  flavor?: string,
})
// Returns: { buildId, summary: { success, duration, apkSize, warnings } }

gradle-test({
  operation: "unitTest" | "connectedTest",
  module?: string,
  filter?: string,
  device?: string,
})
// Returns: { testId, summary: { passed, failed, skipped, duration } }

gradle-list({
  operation: "variants" | "modules" | "tasks",
  module?: string,
})
// Returns: { cacheId, variants|modules|tasks: [...] }

gradle-get-details({
  id: string,
  detailType: "logs" | "errors" | "tasks"
})
// Returns full cached output
```

### Emulator

```typescript
emulator-device({
  operation: "list" | "create" | "start" | "kill" | "wipe" |
             "snapshot-save" | "snapshot-load" | "snapshot-list" | "snapshot-delete",
  avdName?: string,
  device?: string,
  systemImage?: string,
  snapshotName?: string,
})
// list returns: { cacheId, summary: { running: [...], available: [...] } }
```

### ADB

```typescript
adb-device({
  operation: "list" | "select" | "wait" | "properties",
  deviceId?: string,
})

adb-app({
  operation: "install" | "uninstall" | "launch" | "stop" | "clear-data",
  apkPath?: string,
  packageName?: string,
})

adb-logcat({
  // Structured mode
  package?: string,
  tags?: string[],
  level?: "verbose" | "debug" | "info" | "warn" | "error",
  // Power mode
  rawFilter?: string,
  // Common
  lines?: number,
  since?: string,
})

adb-shell({
  command: string,
  timeout?: number,
})
// Safety: blocks destructive commands (rm -rf /, reboot, su)
```

### UI Automation

```typescript
ui({
  operation: "dump" | "find" | "tap" | "input" | "screenshot" | "accessibility-check",
  selector?: {
    resourceId?: string,
    text?: string,
    textContains?: string,
    className?: string,
    xpath?: string,
  },
  x?: number,
  y?: number,
  elementIndex?: number,
  text?: string,
  name?: string,
})
// dump returns: { cacheId, tree: AccessibilityNode[] }
// find returns: { elements: [{ index, bounds, text, resourceId }] }
```

### Utilities

```typescript
cache({
  operation: "get-stats" | "clear" | "get-config" | "set-config",
  key?: string,
  config?: { ttl?: number },
})

rtfm({
  category?: string,
  tool?: string,
})
```

## Progressive Disclosure & Caching

Every expensive operation returns summary + cache ID, never raw output.

**Cache TTLs:**

| Data Type | TTL | Invalidation Events |
|-----------|-----|---------------------|
| Build output | 30 min | New build started |
| Test results | 30 min | New test run |
| Emulator list | 5 min | create, start, kill operations |
| App list | 2 min | install, uninstall operations |
| UI tree | 30 sec | tap, input operations |
| Logcat | No cache | Always fresh |
| Gradle variants | 1 hour | (rarely changes) |

**Cache Storage:**
- In-memory `Map<cacheId, { data, expiresAt, metadata }>`
- Max entries: 100 (LRU eviction)
- Max size per entry: 1MB

**Token Budget Targets:**

| Operation | Raw CLI | With Progressive Disclosure | Reduction |
|-----------|---------|----------------------------|-----------|
| `gradle-build` | ~5,000 | ~50 | 99% |
| `emulator-device list` | ~2,000 | ~100 | 95% |
| `ui dump` | ~3,000 | ~200 | 93% |

## State Management

Single "current device" tracked in server state:

```typescript
interface DeviceState {
  currentDevice: {
    id: string;
    type: "emulator" | "physical";
    name: string;
    status: "online" | "offline" | "booting";
  } | null;
}
```

- Auto-select if only one device available
- Clear error if no device selected and agent tries device-dependent operation
- In-memory only, resets on server restart

## Error Handling

**Error Categories:**
- Device errors: `NO_DEVICE_SELECTED`, `DEVICE_NOT_FOUND`, `DEVICE_OFFLINE`
- Build errors: `BUILD_FAILED`, `GRADLE_NOT_FOUND`, `MODULE_NOT_FOUND`
- App errors: `APK_NOT_FOUND`, `PACKAGE_NOT_FOUND`, `INSTALL_FAILED`
- Emulator errors: `AVD_NOT_FOUND`, `EMULATOR_START_FAILED`, `SNAPSHOT_NOT_FOUND`
- Safety errors: `COMMAND_BLOCKED`, `TIMEOUT`
- Cache errors: `CACHE_MISS`

**Error Response Structure:**
```typescript
interface ToolError {
  error: ErrorCode;
  message: string;
  suggestion?: string;
  details?: object;
}
```

**Safety Guards (adb-shell):**
- Blocked: `rm -rf /`, `reboot`, `shutdown`, `su`, `root`, system partition writes
- Timeout: Default 30s, max 120s

## File Structure

```
replicant-mcp/
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── tools/                   # One file per tool
│   ├── adapters/                # CLI wrappers (adb, emulator, gradle)
│   ├── services/                # cache-manager, device-state, process-runner
│   ├── parsers/                 # Output parsers
│   └── types/                   # Shared types
├── docs/rtfm/                   # On-demand documentation
├── tests/
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

## Out of Scope (v1)

- Firebase Test Lab integration
- Physical device farm management
- CI/CD pipeline integration
- Gradle build cache optimization
- Agent integration tests (BAML)
- Multi-device orchestration

## Success Criteria

An AI agent can:
1. Query build variants and build an Android app with token-efficient summary
2. Launch emulator, install app, run it
3. Navigate UI via accessibility tree (not screenshots)
4. Debug a failing test with filtered logcat
5. All without exceeding reasonable context limits

## Reference

- [xc-mcp](https://github.com/conorluddy/xc-mcp) - Primary reference implementation (iOS)
