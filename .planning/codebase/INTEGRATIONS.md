# External Integrations

**Analysis Date:** 2026-03-25

## APIs & External Services

**Android Development Tools:**
- adb (Android Debug Bridge) - Device communication and package management
  - Client: Via `execa` process execution in `src/adapters/adb.ts`
  - Invoked by: `AdbAdapter` class methods (getDevices, install, uninstall, launch, stop, etc.)
  - Location: Detected via ANDROID_HOME or ANDROID_SDK_ROOT environment variable

- gradle (Gradle build system) - Android project building and testing
  - Client: Via `execa` process execution in `src/adapters/gradle.ts`
  - Invoked by: `GradleAdapter` class methods (build, test, list, getDetails)
  - Location: Project root specified by REPLICANT_PROJECT_ROOT or REPLICANT_CONFIG

- Android Emulator - Virtual device management and UI automation
  - Client: Via `execa` process execution in `src/adapters/emulator.ts`
  - Invoked by: `EmulatorAdapter` class methods (list, start, stop, kill)
  - Location: Detected via Android SDK path

- UIAutomator/UI Automation Framework - UI element inspection and interaction
  - Client: Via adb shell commands in `src/adapters/ui-automator.ts`
  - Used by: `UiAutomatorAdapter` (query elements, capture screenshots, perform actions)
  - Returns: XML accessibility hierarchy and screenshot base64 encoding

## Data Storage

**Databases:**
- None - No persistent database integrations

**File Storage:**
- Local filesystem - Used for:
  - Configuration file loading from REPLICANT_CONFIG path (`src/services/config.ts`)
  - Screenshot caching and temporary image processing (`src/services/visual-candidates.ts`, `src/services/grid.ts`)
  - Test baseline files and results in `.planning/baselines/` directory
  - In-memory cache only (`src/services/cache-manager.ts`) - no persistence to disk

**Caching:**
- In-memory cache via `CacheManager` - Stores UI find results and query caches
  - Location: `src/services/cache-manager.ts`
  - Scope: Per-process only, cleared on server restart
  - No external cache service (Redis, etc.)

## Authentication & Identity

**Auth Provider:**
- None required - MCP server uses stdio transport with direct process invocation
- No user authentication or identity management
- Device authentication via adb (handled by Android device/emulator)

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service (Sentry, Rollbar, etc.)

**Logs:**
- Custom logger via `src/utils/logger.ts`
- Output: stdout/stderr
- Levels: Configurable via REPLICANT_LOG_LEVEL env var
- Format: JSON (if REPLICANT_LOG_FORMAT=json) or text (default)
- Patterns: Structured logging with context objects in error reporting

## CI/CD & Deployment

**Hosting:**
- npm registry - Published as `replicant-mcp` package
- GitHub repository: https://github.com/thecombatwombat/replicant-mcp.git

**CI Pipeline:**
- None externally configured (GitHub Actions or similar not referenced in code)
- Local validation: `npm run validate` runs build, lint, complexity checks, and tests
- Release management: bash scripts in `scripts/release.sh` for semantic versioning

## Environment Configuration

**Required env vars:**
- ANDROID_HOME or ANDROID_SDK_ROOT - Path to Android SDK (required for runtime)

**Optional env vars:**
- REPLICANT_CONFIG - Path to YAML configuration file
- REPLICANT_PROJECT_ROOT - Android project root directory
- REPLICANT_LOG_LEVEL - Logging level
- REPLICANT_LOG_FORMAT - Logging output format (json or text)

**Secrets location:**
- No secrets stored in codebase
- Configuration via environment variables and YAML files (not version controlled if sensitive)

## Webhooks & Callbacks

**Incoming:**
- None - MCP server uses request/response pattern via stdio transport

**Outgoing:**
- None - Tool operations are synchronous, no event webhooks or callbacks

## Service Communication Patterns

**Process Execution:**
- All external service communication via `ProcessRunner` (`src/services/process-runner.ts`)
- Process execution library: `execa` 9.6.1
- Safety constraints: Command blocklist in `BLOCKED_COMMANDS` and `BLOCKED_PATTERNS` (prevents destructive commands)
- Timeout support: Configurable via `RunOptions.timeoutMs`

**OCR Integration:**
- tesseract.js 7.0.0 - Optical character recognition
- Singleton worker pattern: `src/services/ocr.ts` maintains single Worker instance
- Language: English ("eng")
- Confidence scoring: Returns 0-1 normalized confidence for recognized text

**Image Processing:**
- sharp 0.34.5 - Screenshot processing and visual candidate filtering
- Operations: Crop, scale, color operations for visual matching
- Used in: `src/services/visual-candidates.ts` and `src/services/grid.ts`

---

*Integration audit: 2026-03-25*
