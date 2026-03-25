# Anthropic Connectors Directory - Form Answers for replicant-mcp

## Advisory Notes

- **Form URL:** https://forms.gle/tyiAZvch1kDADKoP9
- **Submission track:** Local MCP Server (NOT Remote -- replicant-mcp requires local Android SDK)
- **Known concern -- Tool safety annotations:** `readOnlyHint`/`destructiveHint` annotations are not yet added to tool definitions. This is the #1 rejection cause (30% of rejections per Anthropic Directory FAQ). The form can be submitted now since review takes weeks, allowing time to add annotations before review completes. A note about annotations being in progress is included in the testing notes below.
- **Privacy section follow-up:** README currently lacks a dedicated Privacy section. The privacy statement below is accurate (local-only, no data collection), but a formal Privacy section should be added to README as a follow-up item before review completes.

---

## Form Fields

### 1. Server Name

```
replicant-mcp
```

### 2. Description (Short)

```
Android MCP server for AI-assisted Android development. Provides 14 tools for building APKs, managing emulators, installing and launching apps, automating UI interactions via accessibility, and analyzing device logs -- all through natural conversation with Claude.
```

### 3. GitHub URL

```
https://github.com/thecombatwombat/replicant-mcp
```

### 4. npm Package

```
replicant-mcp
```

### 5. Transport Type

```
stdio
```

### 6. Setup Instructions

```
Prerequisites: Node.js 18+, Android SDK with adb and emulator in PATH.

Install and run:
npx -y replicant-mcp

Claude Desktop configuration (claude_desktop_config.json):
{
  "mcpServers": {
    "replicant-mcp": {
      "command": "npx",
      "args": ["-y", "replicant-mcp"]
    }
  }
}

No API keys or cloud accounts required. All operations execute locally against the user's Android SDK.
```

### 7. Example Prompts (5 working examples)

**Example 1:**
```
"Build and run my Android app on the emulator"
```
Uses: gradle-build, emulator-device, adb-app. Builds the APK via Gradle, ensures an emulator is running, installs the APK, and launches the app.

**Example 2:**
```
"Find and tap the login button, then enter test@example.com as the email"
```
Uses: ui-query, ui-action. Queries the UI tree via accessibility services to locate the login button, taps it, then finds the email input field and enters text.

**Example 3:**
```
"Show me crash logs from the last 5 minutes filtered by my app's package"
```
Uses: adb-logcat. Reads device logs filtered by package name with a time window, returning crash-level entries with stack traces.

**Example 4:**
```
"Take a screenshot of the current screen and describe what you see"
```
Uses: ui-capture. Captures a screenshot from the connected device/emulator and returns it for visual analysis.

**Example 5:**
```
"List all running emulators and their properties"
```
Uses: emulator-device, adb-device. Lists active emulator instances and retrieves device properties including API level, screen density, and available memory.

### 8. Testing Notes / Test Credentials

```
Reviewer needs Android SDK with adb and emulator in PATH. No cloud accounts or API keys needed.

Recommended setup for testing:
1. Install Android Studio (includes Android SDK, adb, and emulator)
2. Create an AVD (Android Virtual Device) via AVD Manager -- a Pixel device with API 34+ works well
3. Start the emulator
4. Run: npx -y replicant-mcp

All operations are local. No network access to external services is required.

Note: Tool safety annotations (readOnlyHint/destructiveHint) are being added to all 14 tool definitions and will be present before review completes. The tool descriptions and behavior are accurate as-is.
```

### 9. Tool Count and Categories

```
14 tools across 6 categories:

ADB Device (4 operations): list, select, properties, wait, health-check
ADB App (5 operations): list, install, launch, stop, uninstall, clear-data
ADB Logcat: Read and filter device logs by package, tag, level, time range
ADB Shell: Execute arbitrary shell commands on device
Emulator Device (6 operations): list, create, start, stop, wipe, delete, snapshot management
Gradle Build: Build APKs and app bundles
Gradle Test: Run unit and instrumentation tests
Gradle List: Introspect project structure (modules, tasks, dependencies)
Gradle Get Details: Retrieve cached build/test output details
UI Query: Query app UI elements via accessibility services
UI Action: Interact with UI (tap, input text, scroll, swipe)
UI Capture: Capture device screenshots
Cache: Manage response cache (stats, clear, configure)
RTFM: Built-in documentation and usage guides
```

### 10. Privacy / Data Collection Statement

```
replicant-mcp does not collect, transmit, or store any user data. All operations execute locally on the user's machine against their local Android SDK. No network calls are made to external services. Build artifacts and logs are stored in the local .replicant/ directory and can be cleared at any time.
```

### 11. Contact Information

```
[YOUR_EMAIL]
```

> **ACTION REQUIRED:** Replace [YOUR_EMAIL] with your contact email before submitting the form.

### 12. License

```
MIT
```
