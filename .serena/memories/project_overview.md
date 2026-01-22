# replicant-mcp Project Overview

## Purpose
An MCP (Model Context Protocol) server for AI-assisted Android development. Enables AI assistants to build APKs, manage emulators, install apps, automate UI, and debug crashes through natural conversation.

**Current version**: 1.1.1
**npm package**: `replicant-mcp`
**Author**: Archit Joshi

## Tech Stack
- **Language**: TypeScript (ES2022, strict mode)
- **Runtime**: Node.js 18+
- **Build**: `tsc` → outputs to `dist/`
- **Testing**: Vitest (216 tests)
- **Package Format**: ES Modules (`"type": "module"`)

### Dependencies
| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `zod` | Schema validation for tool inputs |
| `sharp` | Image processing (screenshots, grid overlays) |
| `tesseract.js` | OCR fallback for UI element finding |
| `execa` | Process execution (adb, gradle, emulator) |
| `commander` | CLI framework |
| `yaml` | Config file parsing |

## Project Structure
```
src/
├── index.ts              # MCP server entry point
├── server.ts             # Server setup, tool registration
├── cli.ts                # CLI entry point
├── tools/                # 12 MCP tool implementations
│   ├── adb-device.ts     # Device listing/selection
│   ├── adb-app.ts        # App install/launch/stop
│   ├── adb-logcat.ts     # Log filtering
│   ├── adb-shell.ts      # Shell commands (with safety guards)
│   ├── emulator-device.ts # Emulator lifecycle, snapshots
│   ├── gradle-build.ts   # Build APKs/bundles
│   ├── gradle-test.ts    # Run tests
│   ├── gradle-list.ts    # List modules/variants/tasks
│   ├── gradle-get-details.ts # Fetch cached full output
│   ├── ui.ts             # UI automation (main tool)
│   ├── cache.ts          # Cache management
│   └── rtfm.ts           # On-demand documentation
├── adapters/             # CLI wrappers
│   ├── adb.ts
│   ├── gradle.ts
│   ├── emulator.ts
│   └── ui-automator.ts
├── services/             # Core services
│   ├── cache-manager.ts  # Progressive disclosure cache
│   ├── device-state.ts   # Selected device tracking
│   ├── process-runner.ts # Command execution
│   ├── config.ts         # YAML config loading
│   ├── ocr.ts            # Tesseract OCR
│   ├── grid.ts           # Grid overlay for precision tapping
│   ├── icon-patterns.ts  # Icon recognition patterns
│   └── visual-candidates.ts # Visual fallback logic
├── parsers/              # Output parsers
├── types/                # TypeScript types
└── cli/                  # CLI command implementations
tests/                    # Unit, integration tests
docs/rtfm/                # On-demand documentation files
scripts/                  # Utility scripts
```

## Key Design Patterns

### 1. Progressive Disclosure
Tools return summaries with cache IDs. Use `gradle-get-details` for full output. Reduces token usage by 90-99%.

### 2. Single Device Focus
Select device once with `adb-device select`, all subsequent commands target it automatically.

### 3. Accessibility-First UI with Multi-Tier Fallback
1. **Accessibility tree** - Fast, text-based element finding
2. **OCR fallback** - Tesseract extracts text from screenshot
3. **Visual fallback** - Returns screenshot + metadata for AI vision

### 4. Spatial Proximity Search
Find elements near other elements: `{ selector: { text: "edit", nearestTo: "John" } }`

### 5. Grid-Based Precision Tapping
24-cell grid overlay for tapping icons without text labels.
