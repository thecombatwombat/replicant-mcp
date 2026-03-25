# Codebase Structure

**Analysis Date:** 2026-03-25

## Directory Layout

```
replicant-mcp/
├── src/                          # Main source code (7,727 lines)
│   ├── index.ts                  # Entry point - routes to server or CLI
│   ├── server.ts                 # MCP server setup, context, dispatch
│   ├── cli.ts                    # CLI entry - aggregates commands
│   ├── version.ts                # Version constant
│   ├── adapters/                 # External tool wrappers
│   │   ├── adb.ts                # Android Debug Bridge
│   │   ├── emulator.ts           # Emulator control
│   │   ├── gradle.ts             # Gradle build system
│   │   ├── ui-automator.ts       # UIAutomator2 service
│   │   ├── ui-fallback-find.ts   # UI element fallback chain
│   │   └── index.ts              # Barrel export
│   ├── services/                 # Stateful services
│   │   ├── cache-manager.ts      # In-memory cache with TTL
│   │   ├── device-state.ts       # Current device context, auto-select
│   │   ├── process-runner.ts     # Subprocess execution + safety validation
│   │   ├── environment.ts        # System environment detection
│   │   ├── config.ts             # Load/get .replicant/config.yaml
│   │   ├── ocr.ts                # Tesseract.js text recognition
│   │   ├── icon-patterns.ts      # Visual pattern matching
│   │   ├── visual-candidates.ts  # Element ranking by visual similarity
│   │   ├── grid.ts               # Screen grid element generation
│   │   ├── scaling.ts            # Device resolution scaling
│   │   ├── test-baseline.ts      # Screenshot baseline comparison
│   │   └── index.ts              # Barrel export
│   ├── tools/                    # MCP tool handlers (14 tools)
│   │   ├── cache.ts              # Cache mgmt tool
│   │   ├── rtfm.ts               # Read-the-FM tool (docs)
│   │   ├── adb-device.ts         # List/select/clear devices
│   │   ├── adb-app.ts            # Install/launch/stop apps
│   │   ├── adb-logcat.ts         # View device logs
│   │   ├── adb-shell.ts          # Execute shell commands
│   │   ├── emulator-device.ts    # List/start/stop emulators
│   │   ├── gradle-build.ts       # Build APK
│   │   ├── gradle-test.ts        # Run unit/instrumented tests
│   │   ├── gradle-list.ts        # List gradle modules/tasks
│   │   ├── gradle-get-details.ts # Get build artifact details
│   │   ├── ui-query.ts           # Dump/find/check UI accessibility
│   │   ├── ui-action.ts          # Tap/type/scroll/gesture
│   │   ├── ui-capture.ts         # Screenshot + OCR
│   │   ├── ui-find.ts            # UI element discovery logic
│   │   └── index.ts              # Barrel export + schema aggregation
│   ├── cli/                      # CLI command builders
│   │   ├── gradle.ts             # gradle command
│   │   ├── adb.ts                # adb command
│   │   ├── emulator.ts           # emulator command
│   │   ├── ui.ts                 # ui command
│   │   ├── cache.ts              # cache command
│   │   ├── doctor.ts             # doctor command
│   │   ├── formatter.ts          # JSON/table output formatting
│   │   └── index.ts              # Barrel export
│   ├── parsers/                  # Command output parsing
│   │   ├── adb-output.ts         # Parse adb device list, packages
│   │   ├── emulator-output.ts    # Parse emulator list output
│   │   ├── gradle-output.ts      # Parse gradle build/test output
│   │   ├── ui-dump.ts            # Parse UIAutomator XML to tree
│   │   └── index.ts              # Barrel export
│   ├── types/                    # Type definitions
│   │   ├── errors.ts             # ReplicantError, ErrorCode enum
│   │   ├── device.ts             # Device interface
│   │   ├── cache.ts              # Cache types, TTL constants
│   │   ├── config.ts             # Config interface, defaults
│   │   ├── ocr.ts                # OCR result types
│   │   ├── icon-recognition.ts   # UI element union, find options
│   │   ├── index.ts              # Barrel export
│   │   └── schemas/              # Zod validation schemas
│   │       ├── adb-*.ts          # adb tool output schemas (4 files)
│   │       ├── gradle-*.ts       # gradle tool output schemas (5 files)
│   │       ├── emulator-*.ts     # emulator output schema
│   │       ├── ui-output.ts      # UI dump schema
│   │       ├── cache-output.ts   # Cache tool output
│   │       ├── rtfm-output.ts    # RTFM tool output
│   │       └── index.ts          # Barrel export
│   └── utils/                    # Utilities
│       ├── logger.ts             # Structured logging
│       ├── paths.ts              # Path resolution helpers
│       └── (more utilities)
├── tests/                        # Test suite (mirrors src structure)
│   ├── integration/              # End-to-end tests
│   ├── tools/                    # Tool handler tests
│   ├── adapters/                 # Adapter tests
│   ├── services/                 # Service tests
│   ├── schemas/                  # Type validation tests
│   ├── cli/                      # CLI tests
│   ├── server/                   # Server tests
│   ├── utils/                    # Utility tests
│   ├── types/                    # Type tests
│   └── fixtures/                 # Test data
│       ├── contracts/            # Contract files (expected outputs)
│       └── (more fixtures)
├── dist/                         # Compiled JavaScript (generated)
├── docs/                         # Documentation
│   ├── rtfm/                     # Read-the-FM content (tool docs)
│   ├── contracts/                # Contract specifications
│   └── plans/                    # Implementation plans
├── scripts/                      # Build/test scripts
│   ├── check-prerequisites.sh    # Verify Android SDK, adb, etc.
│   ├── smoke-test.sh             # Integration smoke test
│   ├── check-complexity.sh       # Enforce file/function size limits
│   ├── release.sh                # Release automation
│   ├── real-device-test.ts       # Real device testing script
│   ├── generate-contract.ts      # Contract generation
│   ├── check-contracts.ts        # Contract validation
│   └── contract-test.ts          # Contract testing
├── tsconfig.json                 # TypeScript config (ES2022, strict)
├── vitest.config.ts              # Test runner config
├── eslint.config.js              # Linting rules
├── package.json                  # Dependencies + scripts
├── CLAUDE.md                     # Project conventions (read carefully)
└── .replicant/                   # Device config (gitignored)
```

## Directory Purposes

**src/:**
- Purpose: All production TypeScript source
- Contains: Adapters, services, tools, types, parsers, CLI
- Key files: `index.ts` (entry), `server.ts` (MCP), `cli.ts` (CLI)

**src/adapters/:**
- Purpose: Wrap external tools (adb, gradle, emulator, UIAutomator)
- Contains: Process execution, output parsing coordination, error mapping
- Key files: `adb.ts` (most used), `ui-automator.ts` (UI operations)

**src/services/:**
- Purpose: Stateful cross-cutting concerns
- Contains: Device state, caching, config, process management, visual processing
- Key files: `process-runner.ts` (all commands run here), `device-state.ts` (auto-select)

**src/tools/:**
- Purpose: MCP tool operation handlers
- Contains: Input validation (Zod), operation dispatch, result formatting
- Key files: `ui-query.ts` (most complex), `index.ts` (schema aggregation)

**src/types/:**
- Purpose: Shared type definitions and error codes
- Contains: Error codes, device types, cache config, UI element unions
- Key files: `errors.ts` (ReplicantError), `icon-recognition.ts` (FindElement union)

**src/types/schemas/:**
- Purpose: Zod validation schemas for tool inputs/outputs
- Contains: One schema file per tool (e.g., `gradle-build-output.ts`)
- Key files: All imported by `src/tools/index.ts`

**src/parsers/:**
- Purpose: Transform raw command output to typed structures
- Contains: Regex parsing, XML parsing, output normalization
- Key files: `ui-dump.ts` (parses UIAutomator XML), `adb-output.ts` (device list)

**src/cli/:**
- Purpose: Command-line interface command definitions
- Contains: Commander.js command builders, CLI-specific formatting
- Key files: `formatter.ts` (JSON/table output), `doctor.ts` (health check)

**tests/:**
- Purpose: Unit and integration tests
- Contains: Mirrors src structure with .test.ts files
- Key files: `fixtures/` (test data), `integration/` (e2e tests)

**docs/rtfm/:**
- Purpose: Tool documentation (served by `rtfm` tool)
- Contains: Markdown guides for each tool category
- Key files: Loaded dynamically by `handleRtfmTool`

## Key File Locations

**Entry Points:**
- `src/index.ts`: Dual-mode router (server if no args, CLI if args)
- `src/server.ts`: MCP server creation, tool registration, dispatch
- `src/cli.ts`: CLI program setup, command aggregation

**Configuration:**
- `src/services/config.ts`: Loads `.replicant/config.yaml` at startup
- `src/types/config.ts`: Default config + TypeScript interface
- `tsconfig.json`: ES2022, strict mode, Node.js imports

**Core Logic:**
- `src/adapters/adb.ts`: All adb interactions (device list, install, launch, shell)
- `src/services/device-state.ts`: Device selection, auto-select logic
- `src/tools/ui-find.ts`: UI element discovery with fallback chain
- `src/services/process-runner.ts`: Subprocess execution, safety validation

**Testing:**
- `vitest.config.ts`: Test runner config, coverage thresholds
- `tests/fixtures/`: Test data (device lists, build outputs, UI dumps)
- `tests/integration/`: End-to-end tool tests

## Naming Conventions

**Files:**
- Adapters: `<tool>-adapter.ts` (e.g., `adb-adapter.ts` for AdbAdapter class)
- Tools: `<tool-name>.ts` (e.g., `adb-device.ts`, `ui-query.ts`)
- Services: `<service-name>.ts` (e.g., `cache-manager.ts`, `device-state.ts`)
- Parsers: `<source>-output.ts` (e.g., `adb-output.ts`, `gradle-output.ts`)
- Types: `<domain>.ts` (e.g., `device.ts`, `cache.ts`)
- Schemas: `<tool>-output.ts` (e.g., `gradle-build-output.ts`)

**Directories:**
- Singular or plural depending on contents: `adapters/`, `services/`, `tools/`, `types/schemas/`

**Functions:**
- camelCase with verb prefix: `handleCacheTool`, `parseDeviceList`, `ensureDevice`
- Exports from handlers: `handle<Tool>Tool`, `<tool>InputSchema`, `<tool>ToolDefinition`

**Variables:**
- camelCase: `deviceId`, `currentDevice`, `cacheManager`
- Constants UPPER_SNAKE_CASE: `DEFAULT_TIMEOUT_MS`, `CACHE_TTLS`, `ERROR_CODE`

**Types:**
- PascalCase: `Device`, `CacheManager`, `ReplicantError`, `FindElement`
- Interfaces: `ServerContext`, `RunOptions`, `UiConfig`
- Unions: `FindElement = AccessibilityNode | OcrElement | GridElement`

## Where to Add New Code

**New MCP Tool:**
1. Create `src/tools/<tool-name>.ts` with handler + schema
2. Create `src/types/schemas/<tool>-output.ts` for result validation
3. Add exports to `src/tools/index.ts`
4. Register in `src/server.ts` dispatchToolCall switch + toolDefinitions array

**New CLI Command:**
1. Create `src/cli/<command>.ts` with `createCommand()` export
2. Add import + `program.addCommand()` in `src/cli.ts`
3. Reuse tool handlers where possible

**New Service:**
1. Create `src/services/<service-name>.ts`
2. Export from `src/services/index.ts`
3. Add to `ServerContext` interface in `src/server.ts`
4. Initialize in `createServerContext()`

**New Adapter:**
1. Create `src/adapters/<tool>-adapter.ts`
2. Extend via `ProcessRunner` for command execution
3. Export from `src/adapters/index.ts`
4. Add to `ServerContext`

**New Type/Error Code:**
1. Add to `src/types/errors.ts` (ErrorCode enum) or `src/types/<domain>.ts`
2. Export from `src/types/index.ts`

**New Utility Function:**
1. Create `src/utils/<function-name>.ts`
2. Export from `src/utils/index.ts` (if exists) or directly from file

## Special Directories

**dist/:**
- Purpose: Compiled JavaScript output
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)

**.replicant/:**
- Purpose: Device configuration, credentials, build cache
- Generated: Yes (by tools, auto-created)
- Committed: No (in .gitignore) - security

**docs/rtfm/:**
- Purpose: Tool documentation markdown files
- Generated: No (hand-authored)
- Committed: Yes (bundled in npm package)

**docs/contracts/:**
- Purpose: Contract specifications for tool I/O validation
- Generated: Partially (some auto-generated by `generate-contract.ts`)
- Committed: Yes (used for contract testing)

**.serena/:**
- Purpose: Agent memory cache (project-local)
- Generated: Yes
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-03-25*
