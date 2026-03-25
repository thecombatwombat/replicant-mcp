# Claude Code Plugin Directory - Form Answers for replicant-mcp

## Advisory Notes

- **Form URL:** https://clau.de/plugin-directory-submission (canonical; also available at claude.ai/settings/plugins/submit)
- **Current state:** replicant-mcp already works as a Claude Code plugin via `/plugin install thecombatwombat/replicant-mcp`. This submission is for official directory listing, enabling discoverability via `/plugin search`.
- **Plugin structure:** Has `.claude/commands/` (6 skills), MCP server via npx, README with docs, MIT license. Does NOT have `.claude-plugin/plugin.json` manifest -- the form likely just needs the repo URL. If review requests a manifest, it can be added later.

---

## Form Fields

### 1. Plugin Name

```
replicant-mcp
```

### 2. Repository URL

```
https://github.com/thecombatwombat/replicant-mcp
```

### 3. Description (Short)

```
Android MCP server for AI-assisted Android development
```

### 4. Description (Detailed)

```
replicant-mcp gives Claude Code full control over Android development workflows. It provides 14 MCP tools across 6 categories (ADB, Emulator, Gradle, UI, Cache, Docs) plus 6 Claude Code skills via .claude/commands/.

What developers can accomplish:
- Build APKs and run tests via Gradle without leaving the conversation
- Create, start, stop, and manage Android emulators including snapshots
- Install, launch, and manage apps on devices and emulators
- Automate UI interactions using accessibility-first element discovery (find elements by text, type, or description, then tap, input text, scroll)
- Analyze device logs with filtering by package, tag, severity level, and time range
- Capture screenshots for visual inspection and debugging

Key design patterns:
- Progressive disclosure for large outputs (build logs, test results) -- returns summaries with cache IDs, detail available on demand
- Accessibility-first UI automation -- queries the accessibility tree rather than relying on fragile coordinate-based interactions
- Smart device selection -- auto-selects when only one device is connected
- All operations are local -- no cloud services, no API keys, no data leaves the machine
```

### 5. Category

```
Developer Tools
```

### 6. Key Features

```
- Build and test Android apps via Gradle (build APKs, run tests, inspect project structure)
- Manage Android emulators (create, start, stop, snapshots, wipe)
- Device management (list, select, properties, health check)
- App lifecycle control (install, launch, stop, uninstall, clear data)
- Accessibility-first UI automation (query elements, tap, input text, scroll, screenshots)
- Log analysis with filtering (by package, tag, level, time range)
- Intelligent response caching for large build/test outputs
- Built-in documentation via rtfm tool
- 6 Claude Code skills (.claude/commands/) for common workflows
```

### 7. Example Prompts (5 working examples)

**Example 1:**
```
"Build and run my Android app on the emulator"
```
Builds the APK via Gradle, ensures an emulator is running, installs the APK, and launches the main activity.

**Example 2:**
```
"Find the login button and tap it, then enter my test credentials"
```
Queries the UI tree via accessibility to find interactive elements, taps the button, locates input fields, and enters text.

**Example 3:**
```
"Show me crash logs from my app in the last 5 minutes"
```
Reads logcat filtered by package name and time window, returning error/fatal entries with stack traces.

**Example 4:**
```
"Create a new Pixel 8 emulator with API 35 and start it"
```
Creates an AVD with the specified device profile and system image, then boots the emulator.

**Example 5:**
```
"Run all unit tests and show me any failures"
```
Executes Gradle test task, returns a summary with pass/fail counts, and provides detailed failure output on request.

### 8. Prerequisites for Users

```
- Node.js 18+
- Android SDK with adb and emulator in PATH
- An Android project to work with (or an emulator for device management tasks)

Recommended: Install Android Studio, which includes the Android SDK, adb, and emulator tools.
No API keys or cloud accounts required.
```

### 9. Install Command

```
npx -y replicant-mcp
```

For Claude Code plugin install:
```
/plugin install thecombatwombat/replicant-mcp
```

### 10. License

```
MIT
```

### 11. Contact

```
[YOUR_EMAIL]
```

> **ACTION REQUIRED:** Replace [YOUR_EMAIL] with your contact email before submitting the form.
