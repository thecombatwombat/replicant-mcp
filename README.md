# replicant-mcp

**Let AI build, test, and debug your Android apps.**

[![CI](https://github.com/thecombatwombat/replicant-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/thecombatwombat/replicant-mcp/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

replicant-mcp is a [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI assistants like Claude the ability to interact with your Android development environment. Build APKs, launch emulators, install apps, navigate UIs, and debug crashes—all through natural conversation.

---

## Demo

![replicant-mcp demo](demo.gif)

---

## Why replicant-mcp?

| Without replicant-mcp | With replicant-mcp |
|-----------------------|-------------------|
| "Run `./gradlew assembleDebug`, then `adb install`, then `adb shell am start`..." | "Build and run the app" |
| Copy-paste logcat output, lose context | AI reads filtered logs directly |
| Screenshot → describe UI → guess coordinates | AI sees accessibility tree, taps elements by text |
| 5,000 tokens of raw Gradle output | 50-token summary + details on demand |

---

## Features

| Category | Capabilities |
|----------|-------------|
| **Build & Test** | Build APKs/bundles, run unit and instrumented tests, list modules/variants/tasks |
| **Emulator** | Create, start, stop, wipe emulators; save/load/delete snapshots |
| **Device Control** | List connected devices, select active device, query device properties |
| **App Management** | Install, uninstall, launch, stop apps; clear app data |
| **Log Analysis** | Filter logcat by package, tag, level, time |
| **UI Automation** | Accessibility-first element finding, spatial proximity search, tap, text input, screenshots |

---

## Coming Soon

- Custom build commands (project-specific overrides, auto-detect gradlew)
- Video capture (start/stop recording, duration-based capture)
- Raw screenshot mode for external context management

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **Android SDK** with `adb` and `emulator` in your PATH
- An Android project with `gradlew` (for build tools)

```bash
node --version      # Should be 18+
adb --version       # Should show Android Debug Bridge version
emulator -version   # Should show Android emulator version
```

### Installation

```bash
npm install -g replicant-mcp
```

### Updating

```bash
npm update -g replicant-mcp
```

---

## Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "replicant": {
      "command": "npx",
      "args": ["-y", "replicant-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add replicant -- npx -y replicant-mcp
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "replicant": {
      "command": "npx",
      "args": ["-y", "replicant-mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "replicant": {
      "command": "npx",
      "args": ["-y", "replicant-mcp"]
    }
  }
}
```

> **Note:** Ensure `adb` and `emulator` are in your PATH, or set `ANDROID_HOME` environment variable. On macOS: `~/Library/Android/sdk`, on Linux: `~/Android/Sdk`.

---

## Example

```
You: "The app crashed after I tapped Login. What happened?"

Claude: Let me check the error logs.
        [Calls adb-logcat with level: "error", lines: 50]

        Found the crash:

        java.lang.NullPointerException: Attempt to invoke virtual method
        'void com.example.User.getName()' on a null object reference
            at com.example.ProfileActivity.onCreate(ProfileActivity.kt:47)

        Looks like `user` is null when ProfileActivity starts.
        Want me to look at that file?
```

---

## Design

replicant-mcp uses progressive disclosure (summaries first, details on demand) to minimize token usage, and accessibility-first UI automation for faster, cheaper, more reliable interactions than screenshot-based approaches. See [docs/architecture.md](docs/architecture.md) for details.

---

## More Info

- **Configuration:** Set `REPLICANT_CONFIG` for advanced options. See [docs/configuration.md](docs/configuration.md).
- **Troubleshooting:** Common issues and solutions in [docs/troubleshooting.md](docs/troubleshooting.md).
- **Tool documentation:** Ask Claude to call `rtfm` with a category like "build", "adb", "emulator", or "ui".

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

---

## Acknowledgments

- Inspired by [xc-mcp](https://github.com/conorluddy/xc-mcp) for iOS
- Built on the [Model Context Protocol](https://modelcontextprotocol.io/)

---

## License

[MIT](LICENSE)

---

**Questions?** [Open an issue](https://github.com/thecombatwombat/replicant-mcp/issues)
