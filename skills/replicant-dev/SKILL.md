---
name: replicant-dev
description: Android development automation - build APKs, run tests, manage emulators, automate UI
---

# Android Development Skill

Automate Android development tasks: build APKs, run tests, manage emulators,
install apps, read logs, and interact with UI elements.

## When to Use

Use this skill when the user asks to:
- Build, compile, or assemble an Android app
- Run unit tests or instrumented tests
- Start, stop, or manage Android emulators
- Install, launch, or uninstall apps on a device
- Read logcat logs or debug crashes
- Tap buttons, enter text, or interact with app UI
- Take screenshots or inspect the accessibility tree

## Prerequisites

- **macOS or Linux** (Windows support coming)
- Node.js 18+
- Android SDK with `adb` and `emulator` in PATH
- An Android project with `gradlew` (for build operations)

## Installation

**Option 1: Via Plugin Marketplace (Recommended)**
```bash
/plugin marketplace add thecombatwombat/replicant-mcp
/plugin install replicant-dev@replicant-mcp
```

**Option 2: Manual Installation**
```bash
git clone https://github.com/thecombatwombat/replicant-mcp.git
cd replicant-mcp
npm install
npm run install-skill
```

## Script Location

All scripts are in this skill's directory. Use the full path:

```
${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/<script-name>.sh
```

## Available Scripts

### Build & Test

| Script | Usage |
|--------|-------|
| `build-apk.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/build-apk.sh <project-path> <debug\|release>` |
| `run-tests.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/run-tests.sh <project-path> [module]` |
| `list-modules.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/list-modules.sh <project-path>` |
| `build-details.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/build-details.sh <build-id> [errors\|warnings\|full]` |

### Emulator

| Script | Usage |
|--------|-------|
| `list-emulators.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/list-emulators.sh` |
| `start-emulator.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/start-emulator.sh <avd-name>` |
| `stop-emulator.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/stop-emulator.sh <device-id>` |
| `snapshot.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/snapshot.sh <save\|load\|list\|delete> <device-id> [name]` |

### Device & App

| Script | Usage |
|--------|-------|
| `list-devices.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/list-devices.sh` |
| `select-device.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/select-device.sh <device-id>` |
| `install-app.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/install-app.sh <apk-path> [device-id]` |
| `launch-app.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/launch-app.sh <package> [activity]` |
| `stop-app.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/stop-app.sh <package>` |
| `uninstall-app.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/uninstall-app.sh <package>` |
| `clear-data.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/clear-data.sh <package>` |

### Logs & Debug

| Script | Usage |
|--------|-------|
| `read-logs.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/read-logs.sh [package] [level] [lines]` |
| `shell-cmd.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/shell-cmd.sh <command>` |

### UI Automation

| Script | Usage |
|--------|-------|
| `dump-ui.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/dump-ui.sh` |
| `find-element.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/find-element.sh <text\|id\|class> <value>` |
| `tap-element.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/tap-element.sh <element-index>` |
| `input-text.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/input-text.sh <text> [element-index]` |
| `screenshot.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/screenshot.sh [output-path]` |

### Cache

| Script | Usage |
|--------|-------|
| `cache-stats.sh` | `${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/cache-stats.sh [clear]` |
