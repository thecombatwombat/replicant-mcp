# Technology Stack

**Analysis Date:** 2026-03-25

## Languages

**Primary:**
- TypeScript 5.9.3 - Entire codebase (src/, tests/)

**Runtime:**
- Node.js >=18.0.0 - Server execution and CLI

## Runtime

**Environment:**
- Node.js >=18.0.0 (specified in `package.json` engines field)

**Package Manager:**
- npm - Standard Node.js package manager
- Lockfile: Yes (package-lock.json committed)

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.25.3 - MCP server implementation via `src/server.ts`
- commander 14.0.2 - CLI command builder via `src/cli.ts`

**Testing:**
- vitest 4.0.17 - Test runner configured in `vitest.config.ts`
- @vitest/coverage-v8 4.0.17 - Coverage reporting (v8 provider)

**Build/Dev:**
- TypeScript 5.9.3 - Compilation (ES2022 target, NodeNext module resolution)
- tsx 4.21.0 - TypeScript execution for scripts
- ESLint 10.0.2 - Linting (config: `eslint.config.js`)
- typescript-eslint 8.56.1 - TypeScript linting rules

## Key Dependencies

**Critical:**
- tesseract.js 7.0.0 - OCR (optical character recognition) for UI text extraction via `src/services/ocr.ts`
- sharp 0.34.5 - Image processing and manipulation for screenshot handling via `src/services/visual-candidates.ts` and `src/services/grid.ts`
- execa 9.6.1 - Process execution for adb, gradle, and emulator commands via `src/services/process-runner.ts`
- yaml 2.8.2 - YAML configuration parsing via `src/services/config.ts`
- zod 4.3.5 - Runtime schema validation for all tool inputs (input schema parsing in `src/server.ts`)

**Infrastructure:**
- crypto (Node.js built-in) - Random token generation for cache entries in `src/services/cache-manager.ts`
- fs/promises (Node.js built-in) - File system operations (config loading in `src/services/config.ts`)
- path (Node.js built-in) - File path operations (SDK detection in `src/services/environment.ts`)
- os (Node.js built-in) - OS detection and home directory resolution in `src/services/environment.ts`

## Configuration

**Environment:**
- REPLICANT_CONFIG - Path to YAML configuration file (optional, loads defaults if unset)
- REPLICANT_PROJECT_ROOT - Android project root directory (optional override)
- REPLICANT_LOG_LEVEL - Logging level (default: unset)
- REPLICANT_LOG_FORMAT - Logging format: "json" or text (default: text)
- ANDROID_HOME - Android SDK root directory (searched in order: ANDROID_HOME, ANDROID_SDK_ROOT)
- ANDROID_SDK_ROOT - Alternative Android SDK root directory
- PATH - System PATH for executable discovery

**Build:**
- `tsconfig.json` - TypeScript configuration (strict mode, ES2022 target)
- `eslint.config.js` - ESLint rules (flat config format)
- `vitest.config.ts` - Test configuration with coverage thresholds (67% lines, 60% branches/functions)

**Configuration file schema:**
- Location: YAML file specified by REPLICANT_CONFIG env var
- Schema: `src/types/config.ts` defines `ReplicantConfig` with `ui` and `build` sections
- UI config: visualModePackages, autoFallbackScreenshot, includeBase64, maxImageDimension
- Build config: projectRoot

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- TypeScript knowledge
- Android SDK (ANDROID_HOME or ANDROID_SDK_ROOT required for runtime)
- npm for dependency management

**Production:**
- Node.js 18.0.0 or higher
- Android SDK with adb, emulator, and gradle tools installed
- Connected Android device or running emulator
- Deployment: npm package (published to npm registry as `replicant-mcp`)
- Runtime mode: MCP server via stdio transport

---

*Stack analysis: 2026-03-25*
