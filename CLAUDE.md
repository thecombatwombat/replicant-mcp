# replicant-mcp

Android MCP server for AI-assisted Android development.

## Quick Start

```bash
npm install
npm run build
npm start
```

## Tool Categories

- **gradle-*** - Build and test Android apps
- **emulator-device** - Manage Android emulators
- **adb-*** - Device and app control
- **ui** - Accessibility-first UI automation
- **cache** - Manage response cache
- **rtfm** - On-demand documentation

## Key Patterns

1. **Progressive Disclosure**: Tools return summaries with cache IDs. Use `*-get-details` for full output.
2. **Single Device Focus**: Use `adb-device list` then `adb-device select` to choose active device.
3. **Accessibility-First**: Prefer `ui dump` over screenshots for UI interaction.

## Common Workflows

**Build and install:**
```
gradle-list { operation: "variants" }
gradle-build { operation: "assembleDebug" }
adb-app { operation: "install", apkPath: "..." }
```

**Debug crash:**
```
adb-logcat { package: "com.example", level: "error", lines: 50 }
```

**UI automation:**
```
ui { operation: "dump" }
ui { operation: "find", selector: { text: "Login" } }
ui { operation: "tap", elementIndex: 0 }
```
