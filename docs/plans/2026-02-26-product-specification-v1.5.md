# replicant-mcp — Product Specification v1.5.0

**Goal**: Establish the formal requirements that the current codebase (v1.5.0) satisfies, as the baseline contract for all future development.

This is a retroactive spec — it captures what *is built and working*, not what's planned. Future features are out of scope.

---

## 1. Product Definition

**replicant-mcp** is an MCP (Model Context Protocol) server that gives AI coding assistants native control over Android development workflows — building, testing, debugging, device management, and UI automation — through structured tool calls over stdio.

**Target users**: AI assistants (Claude, Cursor, Windsurf, Codex CLI) acting on behalf of Android developers.

**Design principles**:
1. **Accessibility-first**: UI interaction via accessibility tree, not screenshots
2. **Progressive disclosure**: Summaries + cache IDs; full output on demand
3. **Single device focus**: One active device at a time; explicit selection
4. **Token efficiency**: Minimize context window consumption in every response
5. **Just works UX**: Auto-detect SDK, auto-select single device, actionable error messages

---

## 2. System Architecture

```
┌─────────────┐
│  MCP Client  │
└──────┬──────┘
       │ stdio (JSON-RPC)
       ▼
┌──────────────────────────────┐
│  Server (server.ts)          │
│  MCP protocol + DI           │
└──────┬───────────────────────┘
       │ dispatch
       ▼
┌──────────────────────────────┐
│  Tools (12)                  │
│  Schema, dispatch, response  │
└──────┬───────────────────────┘
       │ calls
       ▼
┌──────────────────────────────┐
│  Adapters (4)                │
│  adb, gradle, emulator,     │
│  uiautomator                 │
└───┬──────────────────┬───────┘
    │ uses             │ parses output
    ▼                  ▼
┌────────────┐  ┌────────────┐
│ Services   │  │ Parsers (4)│
│ (11)       │  │ Pure fns   │
└─────┬──────┘  └────────────┘
      │ shell exec
      ▼
┌──────────────────────────────┐
│  adb / gradle / emulator     │
│  (external CLI tools)        │
└──────────────────────────────┘
```

### 2.1 Layer Responsibilities

| Layer | Role | Rule |
|-------|------|------|
| **Server** | MCP protocol, input validation (Zod), error formatting, image response handling | No business logic |
| **Tools** | Schema definition, operation dispatch, response shaping, cache storage | One file per tool, handler per operation |
| **Adapters** | Abstraction over CLI tools (adb, gradle, emulator, uiautomator) | No MCP awareness |
| **Services** | Business logic: caching, config, device state, process execution, OCR, grid, scaling | No CLI awareness |
| **Parsers** | Transform raw CLI output → typed structs | Pure functions, no side effects |

### 2.2 Dependency Injection

All shared state flows through `ServerContext` — no module-level mutable state:

```
ServerContext {
  cache: CacheManager
  deviceState: DeviceStateManager
  processRunner: ProcessRunner
  environment: EnvironmentService
  config: ConfigManager
  adb: AdbAdapter
  emulator: EmulatorAdapter
  gradle: GradleAdapter
  ui: UiAutomatorAdapter
  lastFindResults: FindElement[]
}
```

---

## 3. Tool Specifications

### 3.1 Build & Test Tools

#### `gradle-build`
**Purpose**: Build Android APKs and bundles.
**Operations**: `assembleDebug`, `assembleRelease`, `bundle`
**Parameters**: `operation` (required), `module` (optional, e.g. `:app`), `flavor` (optional)
**Returns**: Summary (success, duration, warnings, errors, apkPath) + `buildId` for cache retrieval
**Timeout**: 5 minutes
**Device required**: No

#### `gradle-test`
**Purpose**: Run tests with optional baseline regression detection.
**Operations**: `unitTest`, `connectedTest`, `saveBaseline`, `clearBaseline`
**Parameters**: `operation` (required), `module`, `filter` (e.g. `*LoginTest*`), `taskName`
**Returns**: Summary (passed, failed, skipped, total, duration, failures[], regressions[]) + `testId`
**Timeout**: 10 minutes
**Device required**: Only for `connectedTest`
**Baseline behavior**: `saveBaseline` snapshots passing tests; subsequent `unitTest`/`connectedTest` auto-compare and flag regressions

#### `gradle-list`
**Purpose**: Introspect project structure.
**Operations**: `modules`, `variants`, `tasks`
**Parameters**: `operation` (required), `module` (optional)
**Returns**: Module list / variant list / categorized task summary + cache ID
**Device required**: No

#### `gradle-get-details`
**Purpose**: Retrieve full cached output from prior build/test operations.
**Parameters**: `id` (required), `detailType` (logs|errors|tasks|all), `maxChars`, `summaryOnly`, `previewChars`
**Throws**: `CACHE_MISS` if ID expired or not found

### 3.2 Device & Emulator Tools

#### `adb-device`
**Purpose**: Manage device connections.
**Operations**: `list`, `select`, `wait`, `properties`, `health-check`
**Auto-select**: If exactly one device connected and none selected, auto-selects it
**`properties`**: Returns summary + cache ID (model, Android version, SDK, etc.)
**`health-check`**: Returns SDK paths, server status, warnings, errors

#### `emulator-device`
**Purpose**: Full emulator lifecycle management.
**Operations**: `list`, `create`, `start`, `kill`, `wipe`, `snapshot-save`, `snapshot-load`, `snapshot-list`, `snapshot-delete`
**`start`**: Auto-selects started emulator as current device
**`kill`**: Clears device state if killing the currently selected device
**Snapshot ops**: Require running emulator

#### `adb-app`
**Purpose**: Application lifecycle management.
**Operations**: `install`, `uninstall`, `launch`, `stop`, `clear-data`, `list`
**`list`**: Paginated (limit/offset/filter), returns cache ID
**Device required**: Yes (auto-selects if single)

#### `adb-logcat`
**Purpose**: Filtered log capture.
**Parameters**: `lines` (default 100), `package`, `tags[]`, `level` (verbose→error), `rawFilter`, `since`
**Returns**: Preview (first 20 lines) + error/warning counts + `logId` for full output
**Device required**: Yes

#### `adb-shell`
**Purpose**: Execute arbitrary shell commands with safety guards.
**Parameters**: `command` (required), `timeout` (default 30s, max 120s), `maxChars`, `summaryOnly`
**Safety**: Blocks dangerous commands and shell metacharacters (see §4.4 for full list)
**Device required**: Yes

### 3.3 UI Automation Tools

#### `ui`
**Purpose**: Accessibility-first UI interaction with progressive visual fallback.
**Operations**: `dump`, `find`, `tap`, `input`, `scroll`, `screenshot`, `accessibility-check`, `visual-snapshot`

**`dump`**: Accessibility hierarchy (compact paginated flat list or full tree). Cache ID for full tree.

**`find`**: 5-tier progressive fallback:

| Tier | Source | When used |
|------|--------|-----------|
| 1 | Accessibility tree | Always tried first |
| 2 | Icon pattern matching | resourceId matches known icon patterns |
| 3 | OCR (Tesseract) | Text/textContains selector, accessibility miss |
| 4 | Visual candidates | Unlabeled clickable elements as cropped images |
| 5 | Grid overlay | 4×6 numbered grid for manual coordinate selection |

**`find` parameters**: `selector` (text, textContains, resourceId, className, nearestTo), `maxTier` (1-5), `gridCell`, `gridPosition`, `debug`

**`tap`**: By `elementIndex` (from last find) or explicit `x,y` coordinates. Auto-converts image→device space.

**`screenshot`**: File or inline (base64). Auto-scaled to `maxDimension` (default 800px). `raw` option for full resolution.

**Internal module: `ui-find.ts`** — Not a separate MCP tool. Contains the 5-tier progressive fallback orchestration logic, spatial proximity sorting (`nearestTo`), and element filtering. Called internally by the `ui` tool's `find` operation.

### 3.4 Utility Tools

#### `cache`
**Purpose**: Cache configuration and stats management. Does **not** support retrieving cached entries by ID — use `gradle-get-details` for that.
**Operations**: `get-stats`, `clear`, `get-config`, `set-config`
**Device required**: No

#### `rtfm`
**Purpose**: On-demand documentation retrieval.
**Parameters**: `category` (build, adb, emulator, ui, cache) or `tool` (specific tool name)
**Device required**: No

---

## 4. Cross-Cutting Requirements

### 4.1 Error Handling

All errors use `ReplicantError` with structured output:
```
{ error: ErrorCode, message: string, suggestion?: string, details?: ErrorContext }
```

**Error codes** (25 total, grouped):
- **Device**: NO_DEVICE_SELECTED, DEVICE_NOT_FOUND, DEVICE_OFFLINE, NO_DEVICES, MULTIPLE_DEVICES
- **Build**: BUILD_FAILED, GRADLE_NOT_FOUND, MODULE_NOT_FOUND
- **App**: APK_NOT_FOUND, PACKAGE_NOT_FOUND, INSTALL_FAILED
- **Emulator**: AVD_NOT_FOUND, EMULATOR_NOT_FOUND, EMULATOR_START_FAILED, SNAPSHOT_NOT_FOUND
- **Validation**: INPUT_VALIDATION_FAILED, INVALID_OPERATION, ELEMENT_NOT_FOUND
- **Safety**: COMMAND_BLOCKED, TIMEOUT
- **Cache**: CACHE_MISS
- **Environment**: SDK_NOT_FOUND, ADB_NOT_FOUND, ADB_NOT_EXECUTABLE, ADB_SERVER_ERROR
- **Screenshot**: SCREENSHOT_FAILED, PULL_FAILED
- **Health**: HEALTH_CHECK_FAILED

Every error includes a `suggestion` field with an actionable next step.

### 4.2 Caching

**LRU cache** with configurable limits:
- Default: 100 entries, 1MB max per entry, 5-minute TTL
- Type-specific TTLs:

| Type | TTL |
|------|-----|
| Build output | 30 min |
| Test results | 30 min |
| Gradle variants | 1 hour |
| Emulator list | 5 min (defined but unused — `emulator-device list` does not cache) |
| Device properties | 5 min |
| Logcat | 5 min |
| App list | 2 min |
| UI tree | 30 sec |

### 4.3 Configuration

Loaded from YAML file at `REPLICANT_CONFIG` env var path. Deep-merged with defaults.

```yaml
ui:
  visualModePackages: []        # Skip accessibility for these packages
  autoFallbackScreenshot: true  # Screenshot on empty find results
  includeBase64: false          # Include base64 in responses
  maxImageDimension: 800        # Max screenshot dimension (px)
build:
  projectRoot: ""               # Gradle project root (also: REPLICANT_PROJECT_ROOT env)
```

### 4.4 Safety

- **Command blocking**: Blocked commands: `reboot`, `shutdown`, `halt`, `poweroff`, `rm -rf /`, `rm` on system partitions (`/system`, `/vendor`, `/oem`, `/product`), `sudo`, `su`, `format`, `flash`, `wipe`, `recovery`, `mkfs`, `dd`, `setprop persist.*`. Also blocks shell wrappers (`sh -c`, `bash -c`, etc.)
- **Metacharacter blocking**: Semicolons, `&&`/`||`, pipes, backticks, `$()`, `${}`/`$VAR`, parentheses blocked in adb shell payloads
- **Timeout enforcement**: All process execution has timeouts (default 30s, max 120s for shell; 5min build; 10min test)
- **Input validation**: Zod schemas validate all tool inputs; structured error on invalid input

### 4.5 Environment Detection

Auto-detects Android SDK via: `ANDROID_HOME` → `ANDROID_SDK_ROOT` → platform-specific default paths → `PATH`.

**Platform support**: macOS (darwin), Linux, Windows (win32) — including `.exe`/`.bat` executable mapping.

Only `adb` is required. Emulator tools degrade gracefully if `emulator` binary not found.

### 4.6 MCP Response Format

Tool responses are JSON text by default. **Exception**: when a tool returns `{ base64, mimeType, ...metadata }`, the server emits a dual-content response:
1. `image` content block (base64-encoded image with MIME type)
2. `text` content block (JSON metadata without the image data)

This is used by `ui screenshot` (inline mode) and `ui visual-snapshot`.

### 4.7 Structured Logging

Configurable via environment variables. Supports log levels and structured JSON output format for production diagnostics. Used internally by the server — not exposed as an MCP tool.

### 4.8 Screenshot Scaling

All screenshots auto-scaled to fit `maxImageDimension` (default 800px longest side). Scaling state tracked for coordinate conversion:
- **Image space**: Coordinates in the scaled screenshot
- **Device space**: Actual device pixel coordinates
- Tap commands auto-convert image→device space unless `deviceSpace: true`

---

## 5. Distribution

| Channel | Command |
|---------|---------|
| **npm** | `npm install -g replicant-mcp` |
| **git** | `git clone` + `npm install` + `npm run build` |

**Binary**: `replicant-mcp`
- **No args** → MCP server (stdio JSON-RPC)
- **With args** → CLI mode with subcommands: `gradle`, `adb`, `emulator`, `ui`, `cache`, `doctor`

**CLI examples**: `replicant-mcp doctor`, `replicant-mcp adb devices`

---

## 6. Quality Baselines

| Metric | Current | Enforced |
|--------|---------|----------|
| Tests | 484 (480 pass, 4 skip) | CI gate |
| Line coverage | 68% | Threshold in vitest.config.ts |
| Branch coverage | 60% | Threshold |
| Function coverage | 60% | Threshold |
| Max file length | — | 500 line limit |
| Max function length | — | 80 line limit |
| CI | GitHub Actions | PR-gated |

---

## 7. Known Limitations (current state, not bugs)

1. **Single device only** — No multi-device orchestration
2. **No custom build commands** — Only predefined gradle operations
3. **Gradle timeout capped at 120s** for shell commands (build/test have separate higher limits)
4. **OCR requires Tesseract** — Not bundled, must be available on system
5. **No video capture** — Screenshot-only for visual feedback
6. **No streaming** — All responses are complete payloads (MCP limitation)
7. **Test coverage at 68%** — Below the 90% goal

---

## Acceptance Criteria (this spec is valid when)

- [ ] All 12 tools callable via MCP protocol over stdio
- [ ] Every error code produces structured `{ error, message, suggestion }` output
- [ ] Cache IDs returned by **gradle tools** are retrievable via `gradle-get-details` (**KNOWN GAP**: adb-logcat, adb-device properties, adb-app list, and ui dump return cache IDs that have no retrieval mechanism — `gradle-get-details` only handles gradle-typed entries)
- [ ] Auto-device-selection fires when exactly one device connected
- [ ] Safety guards block all listed dangerous commands
- [ ] Screenshots auto-scale and coordinate conversion round-trips correctly
- [ ] UI find progressive fallback works through tiers 1→5
- [ ] Config loads from REPLICANT_CONFIG with deep merge to defaults
- [ ] Environment detection finds SDK on macOS, Linux, and Windows
- [ ] 480+ tests pass (4 CLI entrypoint tests skipped), coverage thresholds met
