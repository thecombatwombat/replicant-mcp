# replicant-mcp Project Overview

## Purpose
An MCP (Model Context Protocol) server for AI-assisted Android development. Gives AI assistants the ability to interact with Android dev environments: build APKs, manage emulators, install apps, automate UI, and debug crashes.

## Tech Stack
- **Language**: TypeScript (ES2022, strict mode)
- **Runtime**: Node.js 18+
- **Build**: tsc (outputs to `dist/`)
- **Testing**: Vitest
- **Package Format**: ES Modules (`"type": "module"`)
- **Key Dependencies**:
  - `@modelcontextprotocol/sdk` - MCP protocol implementation
  - `zod` - Schema validation
  - `sharp` - Image processing
  - `tesseract.js` - OCR fallback
  - `execa` - Process execution
  - `commander` - CLI framework

## Project Structure
```
src/
  index.ts           # MCP server entry point
  server.ts          # MCP server setup
  cli.ts             # CLI entry point
  tools/             # MCP tool implementations (one file per tool)
  adapters/          # CLI wrappers (adb, emulator, gradle)
  services/          # Core services (cache, device state, process runner)
  parsers/           # Output parsers (gradle, adb, ui-dump)
  types/             # TypeScript types and interfaces
  cli/               # CLI command implementations
docs/rtfm/           # On-demand documentation
tests/               # Unit, integration, and live tests
scripts/             # Utility scripts
```

## Tool Categories
- `gradle-*` - Build, test, list operations
- `emulator-device` - Emulator lifecycle and snapshots
- `adb-*` - Device/app control, logcat, shell
- `ui` - Accessibility-first UI automation with OCR/visual fallback
- `cache` - Response cache management
- `rtfm` - On-demand documentation

## Key Design Patterns
1. **Progressive Disclosure**: Tools return summaries with cache IDs; use `*-get-details` for full output
2. **Single Device Focus**: Select device once, all commands target it
3. **Accessibility-First**: Prefer accessibility tree over screenshots for UI
4. **Multi-tier Fallback**: Accessibility → OCR → Visual for element finding
