# Gradle Project Root Configuration

**Status:** Design complete
**Issue:** replicant-mcp-m64
**Priority:** P1
**Created:** 2026-02-05

## Problem

GradleAdapter runs `./gradlew` relative to `process.cwd()`. In real MCP setups (Claude Desktop, Claude Code), the server launches outside the Android project directory. This causes every Gradle operation to fail with "Gradle wrapper not found" and there is no workaround.

This is a P1 because it means **core Gradle functionality is broken** for the primary use case (MCP clients).

## Solution

Wire the existing `GradleAdapter.projectPath` constructor parameter to user-facing configuration. Two input paths, one behavior:

1. **Environment variable** `REPLICANT_PROJECT_ROOT` — quick, no config file needed
2. **Config file** `build.projectRoot` in `replicant.yaml` — for users who already have a config

The env var takes precedence (easier to set per-session). If neither is set, behavior is unchanged (uses `process.cwd()`).

## Non-goals

These are out of scope and filed as separate issues:

- Auto-detection of project root (walking up directory tree looking for `gradlew`)
- Per-tool-call `projectRoot` parameter override
- Smart `gradlew` vs `gradle` binary selection (covered by existing issue replicant-mcp-o95)
- Runtime "set project root" tool operation

## Design

### Config schema change

```typescript
// src/types/config.ts
export interface BuildConfig {
  /** Absolute path to the Android project root containing gradlew */
  projectRoot?: string;
}

export interface ReplicantConfig {
  ui: UiConfig;
  build: BuildConfig;
}

export const DEFAULT_CONFIG: ReplicantConfig = {
  ui: { /* ... existing ... */ },
  build: {},
};
```

### Config loading change

```typescript
// src/services/config.ts
export async function loadConfig(): Promise<ReplicantConfig> {
  // ... existing YAML loading ...

  return {
    ui: mergeUiConfig(DEFAULT_CONFIG.ui, parsed.ui),
    build: mergeBuildConfig(DEFAULT_CONFIG.build, parsed.build),
  };
}

function mergeBuildConfig(defaults: BuildConfig, overrides?: Partial<BuildConfig>): BuildConfig {
  if (!overrides) return defaults;
  return {
    projectRoot: overrides.projectRoot ?? defaults.projectRoot,
  };
}
```

### Environment variable resolution

In `createServerContext()`, resolve the project root before constructing GradleAdapter:

```typescript
// src/server.ts
export function createServerContext(): ServerContext {
  // ...
  const config = new ConfigManager();
  // Note: config.load() is called later in runServer(), so env var
  // resolution happens at context creation time, and config file
  // value is applied after load(). We need to handle this.
}
```

**Resolution order** (first wins):
1. `REPLICANT_PROJECT_ROOT` env var
2. `build.projectRoot` from config file
3. `undefined` (falls back to `process.cwd()` via execa default)

Since `config.load()` happens after `createServerContext()`, we resolve the final project root after config is loaded. The simplest approach: make GradleAdapter read from config at call time instead of constructor time, OR re-create the adapter after config loads.

**Chosen approach:** Resolve in `runServer()` after `config.load()`, pass to a new method on GradleAdapter:

```typescript
// In GradleAdapter, add:
setProjectPath(path: string): void {
  this.projectPath = path;
}
```

```typescript
// In runServer():
export async function runServer(): Promise<void> {
  const context = createServerContext();
  await context.config.load();

  // Apply project root: env var takes precedence over config file
  const projectRoot = process.env.REPLICANT_PROJECT_ROOT
    || context.config.get().build?.projectRoot;
  if (projectRoot) {
    context.gradle.setProjectPath(projectRoot);
  }

  const server = await createServer(context);
  // ...
}
```

### Error message improvement

When `./gradlew` is not found, the error message should guide users to the fix:

```typescript
// In GradleAdapter.gradle():
throw new ReplicantError(
  ErrorCode.GRADLE_NOT_FOUND,
  "Gradle wrapper not found",
  "Set REPLICANT_PROJECT_ROOT to your Android project directory, " +
  "or add build.projectRoot to your config file. " +
  "See: https://github.com/thecombatwombat/replicant-mcp#configuration"
);
```

### Config file example

```yaml
# replicant.yaml
build:
  projectRoot: /home/user/my-android-app

ui:
  # ... existing ...
```

## Files to modify

| File | Change |
|------|--------|
| `src/types/config.ts` | Add `BuildConfig` interface, update `ReplicantConfig` and `DEFAULT_CONFIG` |
| `src/services/config.ts` | Add `mergeBuildConfig()`, update `loadConfig()` return |
| `src/adapters/gradle.ts` | Add `setProjectPath()` method, improve error message |
| `src/server.ts` | Resolve project root after config load, call `setProjectPath()` |
| `docs/configuration.md` | Document `build.projectRoot` and `REPLICANT_PROJECT_ROOT` |
| `tests/services/config.test.ts` | Test `build.projectRoot` parsing |
| `tests/adapters/gradle.test.ts` | Test `setProjectPath()` and improved error message |

## Validation

- `projectRoot` must be an absolute path (warn if relative)
- Path must exist on disk (warn at startup if not, don't hard fail — user may set up later)
- No trailing slash normalization needed (Node's path APIs handle this)
