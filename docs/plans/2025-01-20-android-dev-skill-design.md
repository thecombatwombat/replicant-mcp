# Android Development Skill for Claude Code

## Overview

Add a Claude Code skill layer alongside the existing MCP server, giving users a choice of interface. The skill reuses existing TypeScript adapters/services via a new CLI entry point.

**Inspired by:** [ios-simulator-skill](https://github.com/conorluddy/ios-simulator-skill)

## Goals

- Full feature parity with the MCP server (all 12 tools)
- Token-efficient output (3-5 lines default, full details on demand)
- Single source of truth — skills call CLI, CLI uses existing adapters
- Easy installation (`npm run install-skill`)

## Non-Goals (Future Work)

- Marketplace publishing
- Windows native support (WSL works for now)

---

## Architecture

```
replicant-mcp/
├── src/
│   ├── index.ts          # MCP server entry (existing)
│   ├── cli.ts            # NEW: CLI entry point for skills
│   ├── cli/              # NEW: Command handlers
│   │   ├── gradle.ts
│   │   ├── emulator.ts
│   │   ├── adb.ts
│   │   ├── ui.ts
│   │   └── cache.ts
│   ├── adapters/         # Shared logic (existing)
│   ├── services/         # Shared logic (existing)
│   └── ...
├── skills/
│   └── replicant-dev/      # Claude Code skill directory
│       ├── SKILL.md      # Skill manifest
│       ├── build-apk.sh
│       ├── run-tests.sh
│       ├── ... (21 scripts total)
├── scripts/
│   └── install-skill.sh  # One-command installer
├── dist/
│   ├── index.js          # Compiled MCP server
│   └── cli.js            # Compiled CLI
└── package.json
```

**How it works:**
1. Skills are thin shell scripts (~10 lines each)
2. Scripts call `node /path/to/dist/cli.js <tool> <args>`
3. CLI imports existing adapters/services — no logic duplication
4. Users install by running `npm run install-skill`

---

## CLI Design

### Commands

```bash
# Build commands
node dist/cli.js gradle build assembleDebug
node dist/cli.js gradle build assembleRelease
node dist/cli.js gradle test --module :app
node dist/cli.js gradle list modules
node dist/cli.js gradle details <cacheId>

# Emulator commands
node dist/cli.js emulator list
node dist/cli.js emulator start Pixel_7_API_34
node dist/cli.js emulator stop emulator-5554
node dist/cli.js emulator snapshot save my-state
node dist/cli.js emulator create --name "Test" --device "pixel_7"

# ADB commands
node dist/cli.js adb devices
node dist/cli.js adb select emulator-5554
node dist/cli.js adb install ./app-debug.apk
node dist/cli.js adb launch com.example.app
node dist/cli.js adb logcat --level error --lines 50
node dist/cli.js adb shell "pm list packages"

# UI commands
node dist/cli.js ui dump
node dist/cli.js ui find --text "Login"
node dist/cli.js ui tap --index 0
node dist/cli.js ui input "hello@example.com"
node dist/cli.js ui screenshot

# Utility commands
node dist/cli.js cache stats
node dist/cli.js cache clear
```

### Output Modes

- **Default:** Token-efficient summary (3-5 lines)
- **`--json`:** Full structured JSON output

---

## Output Format Examples

### Successful Build
```
✓ Build successful (34s)
  APK: app/build/outputs/apk/debug/app-debug.apk (12.4 MB)
  Warnings: 2
  Cache ID: build-a1b2c3 (use 'gradle details build-a1b2c3' for full output)
```

### Failed Build
```
✗ Build failed (12s)

  Error: Execution failed for task ':app:compileDebugKotlin'
  > Unresolved reference: userRepository

  Cache ID: build-x1y2z3

  Run: gradle details build-x1y2z3 --errors    # full stack trace
  Run: gradle details build-x1y2z3 --full      # complete build log
```

### Test Results
```
✓ 47 passed, 2 failed, 0 skipped (18s)

Failed:
  • LoginViewModelTest.testInvalidEmail
  • LoginRepositoryTest.testNetworkError

Cache ID: test-d4e5f6
```

### UI Dump
```
Screen: MainActivity
├─ [0] TextView "Welcome back"
├─ [1] EditText (email input, focused)
├─ [2] EditText (password input)
├─ [3] Button "Login"
└─ [4] Button "Forgot password?"

5 interactive elements
```

### Logcat
```
3 errors in last 50 lines:

E/ProfileActivity: NullPointerException at onCreate:47
E/NetworkClient: Connection timeout after 30s
E/CrashHandler: Fatal exception in main thread

Cache ID: logs-g7h8i9
```

---

## Skill Scripts

### Script List (21 total)

| Script | Purpose |
|--------|---------|
| `build-apk.sh` | Build debug or release APK |
| `run-tests.sh` | Run unit or instrumented tests |
| `list-modules.sh` | List Gradle modules |
| `build-details.sh` | Get full build/test output from cache |
| `list-emulators.sh` | Show available AVDs |
| `start-emulator.sh` | Boot an emulator |
| `stop-emulator.sh` | Shut down an emulator |
| `create-emulator.sh` | Create new AVD |
| `snapshot.sh` | Save/load emulator snapshots |
| `list-devices.sh` | Show connected devices |
| `select-device.sh` | Set active device for commands |
| `install-app.sh` | Install APK to device |
| `launch-app.sh` | Start an app |
| `stop-app.sh` | Force stop an app |
| `uninstall-app.sh` | Remove app from device |
| `clear-data.sh` | Clear app data |
| `read-logs.sh` | Read filtered logcat output |
| `dump-ui.sh` | Get accessibility tree |
| `find-element.sh` | Find UI elements by selector |
| `tap-element.sh` | Tap a UI element |
| `input-text.sh` | Type text into focused field |
| `press-key.sh` | Press hardware keys (back, home) |
| `screenshot.sh` | Capture device screen |
| `shell-cmd.sh` | Run arbitrary adb shell command |
| `cache-stats.sh` | View/manage output cache |

### Script Template

```bash
#!/bin/bash
# <Description>
# Usage: <script>.sh [args]
# Examples:
#   <example 1>
#   <example 2>

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI <tool> <operation> "$@"
```

### Example: build-apk.sh

```bash
#!/bin/bash
# Build an Android APK
# Usage: build-apk.sh [variant]
# Default variant: debug
# Examples:
#   build-apk.sh
#   build-apk.sh release

set -e
VARIANT="${1:-debug}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI gradle build "assemble${VARIANT^}"
```

### Example: tap-element.sh

```bash
#!/bin/bash
# Tap a UI element by text, content-desc, or index
# Usage: tap-element.sh <selector> [value]
# Examples:
#   tap-element.sh --text "Login"
#   tap-element.sh --index 3
#   tap-element.sh --content-desc "Submit button"

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../../dist/cli.js"

$CLI ui tap "$@"
```

---

## SKILL.md Manifest

```markdown
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

## Available Scripts

| Script | Purpose |
|--------|---------|
| `build-apk.sh` | Build debug or release APK |
| `run-tests.sh` | Run unit or instrumented tests |
| `list-emulators.sh` | Show available AVDs |
| `start-emulator.sh` | Boot an emulator |
| `stop-emulator.sh` | Shut down an emulator |
| `list-devices.sh` | Show connected devices |
| `select-device.sh` | Set active device for commands |
| `install-app.sh` | Install APK to device |
| `launch-app.sh` | Start an app |
| `stop-app.sh` | Force stop an app |
| `uninstall-app.sh` | Remove app from device |
| `read-logs.sh` | Read filtered logcat output |
| `clear-data.sh` | Clear app data |
| `dump-ui.sh` | Get accessibility tree |
| `find-element.sh` | Find UI elements by selector |
| `tap-element.sh` | Tap a UI element |
| `input-text.sh` | Type text into focused field |
| `press-key.sh` | Press hardware keys (back, home) |
| `screenshot.sh` | Capture device screen |
| `shell-cmd.sh` | Run arbitrary adb shell command |
| `cache-stats.sh` | View/manage output cache |
```

---

## Installation

### Install Script

**`scripts/install-skill.sh`**
```bash
#!/bin/bash
set -e

SKILL_DIR="$HOME/.claude/skills"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Installing Android Development skill..."

# Build if needed
if [ ! -f "$SCRIPT_DIR/dist/cli.js" ]; then
  echo "Building CLI..."
  cd "$SCRIPT_DIR"
  npm run build
fi

# Create skills dir if needed
mkdir -p "$SKILL_DIR"

# Remove old installation, symlink new
rm -rf "$SKILL_DIR/replicant-dev"
ln -s "$SCRIPT_DIR/skills/replicant-dev" "$SKILL_DIR/replicant-dev"

echo ""
echo "✓ Installed to $SKILL_DIR/replicant-dev"
echo "→ Restart Claude Code to activate"
```

### package.json Addition

```json
{
  "scripts": {
    "install-skill": "bash scripts/install-skill.sh"
  }
}
```

### User Flow

```bash
git clone https://github.com/thecombatwombat/replicant-mcp.git
cd replicant-mcp
npm install
npm run install-skill
# Restart Claude Code
```

---

## Testing Strategy

### CLI Tests (`tests/cli/`)

- Unit tests for argument parsing
- Unit tests for output formatting (summary vs JSON)
- Integration tests verifying CLI produces correct output
- Reuse existing adapter mocks

### Skill Tests (`tests/skills/`)

- Verify each script is executable
- Verify correct shebang (`#!/bin/bash`)
- Smoke test: each script with `--help` or invalid args exits cleanly

### npm Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:cli": "vitest tests/cli/",
    "test:skills": "vitest tests/skills/"
  }
}
```

---

## Deliverables

| Component | Description | Estimate |
|-----------|-------------|----------|
| `src/cli.ts` | CLI entry point | ~100 lines |
| `src/cli/*.ts` | Command handlers | ~300 lines |
| `skills/replicant-dev/SKILL.md` | Manifest | ~50 lines |
| `skills/replicant-dev/*.sh` | 21 shell scripts | ~300 lines |
| `scripts/install-skill.sh` | Installer | ~20 lines |
| `tests/cli/` | CLI tests | ~200 lines |
| `tests/skills/` | Script validation | ~50 lines |
| Updated `README.md` | Dual-usage docs | ~50 lines |

**Total new code:** ~1,000 lines

---

## What Stays Unchanged

- MCP server (`src/index.ts`, `src/server.ts`)
- All adapters (`src/adapters/`)
- All services (`src/services/`)
- All parsers (`src/parsers/`)
- Existing tests

---

## Future Work

- [ ] Marketplace publishing (skill registry)
- [ ] Windows native support
