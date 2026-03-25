# Architecture

**Analysis Date:** 2026-03-25

## Pattern Overview

**Overall:** Layered MCP (Model Context Protocol) server with dual-mode entry point (server + CLI)

**Key Characteristics:**
- Adapter pattern for external tool integration (adb, gradle, emulator, UI automator)
- Service layer for cross-cutting concerns (device state, caching, process execution)
- Tool handler dispatch with Zod validation at boundary
- Fallback chain for UI element discovery (accessibility → OCR → grid → visual)
- Single device context with auto-selection for "just works" UX

## Layers

**Presentation Layer:**
- Purpose: MCP protocol handling and tool registration
- Location: `src/server.ts`, `src/cli.ts`
- Contains: Server setup, tool definitions, request routing
- Depends on: All tool handlers, adapters, services
- Used by: Claude client (MCP), CLI consumers

**Tool Handler Layer:**
- Purpose: Implement MCP tool operations and CLI commands
- Location: `src/tools/*.ts` (14 tools), `src/cli/*.ts` (6 commands)
- Contains: Operation handlers, input validation schemas (Zod), result formatting
- Depends on: Adapters, services, parsers
- Used by: Server dispatch, CLI main

**Adapter Layer:**
- Purpose: Wrap external tools (adb, gradle, emulator, UIAutomator) with error handling
- Location: `src/adapters/*.ts` (4 adapters)
- Contains: `AdbAdapter`, `EmulatorAdapter`, `GradleAdapter`, `UiAutomatorAdapter`
- Depends on: ProcessRunner, parsers
- Used by: Tool handlers, device state manager

**Service Layer:**
- Purpose: Stateful services for device mgmt, caching, config, environment
- Location: `src/services/*.ts` (11 services)
- Contains: `DeviceStateManager`, `CacheManager`, `ProcessRunner`, `ConfigManager`, visual processing (OCR, grid, icon patterns)
- Depends on: Types, ProcessRunner, parsers
- Used by: Tool handlers, adapters, other services

**Parser Layer:**
- Purpose: Transform raw command output into typed structures
- Location: `src/parsers/*.ts` (4 parsers)
- Contains: Output parsing for adb, gradle, emulator, UI dumps
- Depends on: Types
- Used by: Adapters, tool handlers

**Type Layer:**
- Purpose: Shared types, error codes, schemas, validation
- Location: `src/types/*.ts` (schemas in `src/types/schemas/*.ts`)
- Contains: `ReplicantError`, error codes, device types, cache types, UI types
- Depends on: zod
- Used by: All layers

## Data Flow

**MCP Server Request:**

1. Client calls tool via MCP protocol
2. `server.ts` → `dispatchToolCall()` receives request
3. Input validated via Zod schema (throws `ReplicantError` on failure)
4. Tool handler invoked (e.g., `handleUiQueryTool`)
5. Handler uses `ServerContext` to access adapters + services
6. Adapter executes external command via `ProcessRunner`
7. Parser transforms output (e.g., `parseDeviceList`)
8. Service layer enhances result (caching, device state, visual processing)
9. Result formatted and returned as MCP content

**State Management:**

- **Device State:** `DeviceStateManager.currentDevice` - single device context, auto-selects if only one online
- **Cache:** `CacheManager` - in-memory TTL-based cache for UI dumps, OCR results
- **Config:** `ConfigManager` - loads from `.replicant/config.yaml` at startup
- **Context:** `ServerContext` interface holds all services + adapters, passed through tool chain

**Example: UI Find Operation:**

1. `ui-query` tool receives selector (text, resourceId, etc.)
2. Calls `handleUiQueryTool` → `handleFind`
3. `DeviceStateManager.ensureDevice()` auto-selects device
4. `UiAutomatorAdapter.dump()` runs UIAutomator command
5. Output parsed by `parseUiDump()` into `AccessibilityNode[]`
6. Result cached in `CacheManager`
7. Fallback chain tries accessibility match → OCR → grid → visual
8. `FindWithFallbacksResult` returned with tier info + ranked elements

## Key Abstractions

**ReplicantError:**
- Purpose: Typed error with code, message, suggestion, context
- Examples: `src/types/errors.ts`
- Pattern: Thrown at boundaries, converted to `ToolError` for MCP, caught in handler

**ServerContext:**
- Purpose: Dependency injection container for all services + adapters
- Examples: `src/server.ts` lines 57-87
- Pattern: Created at startup, passed to tool handlers, never mutated at module level

**FindElement Union:**
- Purpose: Represent element in any discovery tier (accessibility, OCR, grid, visual)
- Examples: `src/types/icon-recognition.ts`
- Pattern: Type guards (`isAccessibilityNode`, `isOcrElement`, `isGridElement`) for safe narrowing

**Adapter Pattern:**
- Purpose: Hide external tool complexity (adb, gradle) behind typed interface
- Examples: `AdbAdapter.getDevices()`, `GradleAdapter.build()`
- Pattern: Single responsibility, error mapping, output parsing

## Entry Points

**MCP Server Mode:**
- Location: `src/index.ts` (no CLI args) → `src/server.ts`
- Triggers: `replicant-mcp` invoked without arguments
- Responsibilities: Create context, load config, register tools, connect transport

**CLI Mode:**
- Location: `src/index.ts` (with CLI args) → `src/cli.ts`
- Triggers: `replicant-mcp <command> [options]`
- Responsibilities: Parse commands (gradle, adb, emulator, ui, cache, doctor), execute, exit

**Tool Handler Dispatch:**
- Location: `src/server.ts` → `dispatchToolCall()` (lines 106-168)
- Triggers: MCP `CallToolRequest`
- Responsibilities: Route tool name to handler, validate input, handle errors

## Error Handling

**Strategy:** Explicit typed errors with actionable suggestions

**Patterns:**

- `ReplicantError` with `ErrorCode` enum (44 codes) - thrown at logical boundaries
- Input validation via Zod at tool entry - catches schema mismatches early
- Process execution errors caught by `ProcessRunner` - mapped to `ReplicantError`
- Safety validation in `ProcessRunner` - blocks dangerous commands (rm -rf /, sudo, reboot, etc.)
- All errors converted to `ToolError` format for MCP response with suggestion field

**Examples:**
- No device selected → `NO_DEVICE_SELECTED` with suggestion to call `adb-device list`
- Command timeout → `TIMEOUT` with timeout duration in message
- APK not found → `APK_NOT_FOUND` with check APK path suggestion
- Blocked command (rm -rf /) → `COMMAND_BLOCKED` with details

## Cross-Cutting Concerns

**Logging:** `src/utils/logger.ts` - structured logging, used in error handler only

**Validation:** Zod schemas at tool boundary (`src/types/schemas/`) - input schema for each tool

**Authentication:** None - assumes MCP transport (stdio) is already authenticated

**Device Management:** `DeviceStateManager` - auto-select single device, error if none/multiple online

**Caching:** `CacheManager` - TTL-based with cache ID tracking, UI dumps cached for 5min (configurable)

**Process Isolation:** Each adapter command runs via `ProcessRunner` with timeout (30s default, 10min max)

---

*Architecture analysis: 2026-03-25*
