# Gradle Project Root — Implementation Plan

**Design:** [2026-02-05-gradle-project-root-design.md](./2026-02-05-gradle-project-root-design.md)
**Issue:** replicant-mcp-m64

## Steps

### 1. Add BuildConfig to types (`src/types/config.ts`)

- Add `BuildConfig` interface with optional `projectRoot: string`
- Add `build: BuildConfig` to `ReplicantConfig`
- Add `build: {}` to `DEFAULT_CONFIG`

### 2. Update config loading (`src/services/config.ts`)

- Add `mergeBuildConfig()` function (same pattern as `mergeUiConfig`)
- Update `loadConfig()` return to include `build` key
- Add `getBuildConfig()` convenience method to `ConfigManager`

### 3. Add `setProjectPath()` to GradleAdapter (`src/adapters/gradle.ts`)

- Add public `setProjectPath(path: string)` method
- Improve ENOENT error message to mention `REPLICANT_PROJECT_ROOT` and config

### 4. Wire up in server (`src/server.ts`)

- After `config.load()`, resolve project root: `REPLICANT_PROJECT_ROOT` env var > `config.build.projectRoot`
- If resolved, call `context.gradle.setProjectPath(resolvedPath)`
- Log a warning if the path doesn't exist on disk (non-fatal)

### 5. Update docs (`docs/configuration.md`)

- Add `build.projectRoot` to example config
- Document `REPLICANT_PROJECT_ROOT` env var
- Add a "Gradle Setup" section explaining when/why this is needed

### 6. Add tests

**`tests/services/config.test.ts`:**
- Config with `build.projectRoot` loads correctly
- Partial config (only `build`, no `ui`) merges with defaults
- Missing `build` section defaults to `{}`

**`tests/adapters/gradle.test.ts`:**
- `setProjectPath()` changes the cwd used for gradle commands
- Error message mentions REPLICANT_PROJECT_ROOT when gradlew not found

### 7. Validate

- `npm test` — all existing + new tests pass
- `npm run build` — compiles cleanly
