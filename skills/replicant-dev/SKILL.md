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

After installing, run the setup script to build the CLI:
```bash
${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/setup.sh
```

**Option 2: Manual Installation**
```bash
git clone https://github.com/thecombatwombat/replicant-mcp.git
cd replicant-mcp
npm install
npm run build
npm run install-skill
```

## Script Location

All scripts are in this skill's directory:
```
${CLAUDE_PLUGIN_ROOT}/skills/replicant-dev/
```

**Important:** Build scripts (build-apk.sh, run-tests.sh, list-modules.sh) must be run from the Android project directory (where `gradlew` is located).

## Available Scripts

### Build & Test

Run these from the Android project directory:

| Script | Usage |
|--------|-------|
| `build-apk.sh` | `[debug\|release\|bundle]` - Build APK (default: debug) |
| `run-tests.sh` | `[module]` - Run unit tests |
| `list-modules.sh` | List Gradle modules |
| `build-details.sh` | `<build-id> [errors\|warnings\|full]` - Get build details |

### Emulator

| Script | Usage |
|--------|-------|
| `list-emulators.sh` | List available AVDs |
| `start-emulator.sh` | `<avd-name>` - Start emulator |
| `stop-emulator.sh` | `<device-id>` - Stop emulator |
| `snapshot.sh` | `<save\|load\|list\|delete> <device-id> [name]` |

### Device & App

| Script | Usage |
|--------|-------|
| `list-devices.sh` | List connected devices |
| `select-device.sh` | `<device-id>` - Set active device |
| `install-app.sh` | `<apk-path> [device-id]` - Install APK |
| `launch-app.sh` | `<package> [activity]` - Launch app |
| `stop-app.sh` | `<package>` - Force stop app |
| `uninstall-app.sh` | `<package>` - Uninstall app |
| `clear-data.sh` | `<package>` - Clear app data |

### Logs & Debug

| Script | Usage |
|--------|-------|
| `read-logs.sh` | `[package] [level] [lines]` - Read logcat |
| `shell-cmd.sh` | `<command>` - Run adb shell command |

### UI Automation

| Script | Usage |
|--------|-------|
| `dump-ui.sh` | Dump accessibility tree |
| `find-element.sh` | `<text\|id\|class> <value>` - Find element |
| `tap-element.sh` | `<element-index>` - Tap element |
| `input-text.sh` | `<text> [element-index]` - Input text |
| `screenshot.sh` | `[output-path]` - Take screenshot |

### Cache

| Script | Usage |
|--------|-------|
| `cache-stats.sh` | `[clear]` - View/clear cache |
