# replicant-mcp

A Model Context Protocol (MCP) server for AI-assisted Android development. Provides tools for building, testing, and automating Android applications through a standardized interface.

## Features

- **Gradle Integration** - Build, test, and introspect Android projects
- **Emulator Management** - Create, start, stop emulators with snapshot support
- **ADB Control** - Device management, app installation, logcat filtering
- **UI Automation** - Accessibility tree-based UI interaction
- **Smart Caching** - Progressive disclosure with LRU cache for large outputs
- **Safety Guards** - Blocked dangerous commands, input validation

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "replicant": {
      "command": "node",
      "args": ["/path/to/replicant-mcp/dist/index.js"]
    }
  }
}
```

### Standalone

```bash
npm start
```

## Tools

### Build Tools

#### `gradle-build`
Build Android projects.

```json
{ "operation": "assembleDebug" }
{ "operation": "bundleRelease" }
{ "operation": "clean" }
{ "operation": "custom", "tasks": [":app:assembleDebug", ":lib:jar"] }
```

#### `gradle-test`
Run tests with filtering.

```json
{ "operation": "unitTest", "module": ":app" }
{ "operation": "instrumentedTest", "variant": "debug" }
{ "operation": "custom", "tasks": ["testDebugUnitTest"], "filter": "LoginTest" }
```

#### `gradle-list`
Introspect project structure.

```json
{ "operation": "modules" }
{ "operation": "variants", "module": ":app" }
{ "operation": "tasks" }
```

#### `gradle-get-details`
Fetch full output from cached build/test results.

```json
{ "id": "build-abc123-1234567890", "detailType": "errors" }
{ "id": "test-xyz789-1234567890", "detailType": "logs" }
```

### Device Management

#### `emulator-device`
Manage Android emulators.

```json
{ "operation": "list" }
{ "operation": "create", "name": "Pixel_6_API_33", "systemImage": "system-images;android-33;google_apis;x86_64" }
{ "operation": "start", "name": "Pixel_6_API_33" }
{ "operation": "stop", "name": "Pixel_6_API_33" }
{ "operation": "snapshot-save", "name": "Pixel_6_API_33", "snapshotName": "clean-state" }
{ "operation": "snapshot-load", "name": "Pixel_6_API_33", "snapshotName": "clean-state" }
```

#### `adb-device`
Manage connected devices.

```json
{ "operation": "list" }
{ "operation": "select", "deviceId": "emulator-5554" }
{ "operation": "wait", "timeoutMs": 30000 }
{ "operation": "get-prop", "property": "ro.build.version.sdk" }
```

### App Management

#### `adb-app`
Install, uninstall, and manage apps.

```json
{ "operation": "install", "apkPath": "./app/build/outputs/apk/debug/app-debug.apk" }
{ "operation": "uninstall", "package": "com.example.app" }
{ "operation": "launch", "package": "com.example.app", "activity": ".MainActivity" }
{ "operation": "force-stop", "package": "com.example.app" }
{ "operation": "clear-data", "package": "com.example.app" }
{ "operation": "list-packages" }
{ "operation": "permissions", "package": "com.example.app" }
{ "operation": "grant-permission", "package": "com.example.app", "permission": "android.permission.CAMERA" }
```

#### `adb-logcat`
Filter and view device logs.

```json
{ "lines": 100 }
{ "package": "com.example.app", "level": "error", "lines": 50 }
{ "tag": "MyTag", "since": "10s" }
```

#### `adb-shell`
Execute shell commands on device.

```json
{ "command": "pm list packages" }
{ "command": "input tap 500 500" }
```

### UI Automation

#### `ui`
Interact with app UI via accessibility tree.

```json
{ "operation": "dump" }
{ "operation": "find", "selector": { "text": "Login" } }
{ "operation": "find", "selector": { "resourceId": "com.example:id/button" } }
{ "operation": "tap", "elementIndex": 0 }
{ "operation": "tap", "x": 500, "y": 500 }
{ "operation": "input", "text": "Hello World" }
{ "operation": "screenshot", "localPath": "/tmp/screen.png" }
{ "operation": "accessibility-check" }
```

### Utility Tools

#### `cache`
Manage the response cache.

```json
{ "operation": "get", "id": "build-abc123-1234567890" }
{ "operation": "list" }
{ "operation": "clear", "id": "build-abc123-1234567890" }
{ "operation": "clear-all" }
```

#### `rtfm`
Access on-demand documentation.

```json
{ "topic": "patterns" }
{ "topic": "adb" }
{ "topic": "gradle" }
{ "topic": "ui" }
```

## Architecture

```
src/
  server.ts          # MCP server setup and tool registration
  index.ts           # Entry point
  types/             # TypeScript types and error definitions
  services/          # Core services (cache, process runner, device state)
  adapters/          # CLI wrappers (adb, emulator, gradle, ui-automator)
  parsers/           # Output parsers
  tools/             # MCP tool implementations
docs/
  rtfm/              # Documentation files for rtfm tool
```

## Key Patterns

### Progressive Disclosure
Tools return summaries with cache IDs. Use `gradle-get-details` or `cache get` for full output.

### Single Device Focus
Select a device with `adb-device select` and subsequent commands target that device automatically.

### Accessibility-First UI
Use `ui dump` and `ui find` instead of screenshots for reliable, content-based UI interaction.

## Development

```bash
# Run tests
npm test

# Build
npm run build

# Run server
npm start
```

## Requirements

- Node.js 18+
- Android SDK with platform-tools (adb)
- Android SDK emulator (for emulator management)
- Gradle wrapper in project (for build tools)

## License

MIT
