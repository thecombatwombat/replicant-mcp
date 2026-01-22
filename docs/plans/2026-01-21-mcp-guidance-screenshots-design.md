# MCP Guidance & Screenshot Path Improvements

**Date:** 2026-01-21
**Status:** Approved

## Problem Statement

Two user experience issues with replicant-mcp:

1. **Weak MCP guidance**: Claude Code sometimes ignores replicant-mcp in fresh sessions and falls back to raw `adb` commands. The server lacks instructions telling AI assistants to prefer replicant tools.

2. **Screenshot permissions**: Screenshots default to `/tmp/`, which triggers Claude Code permission prompts in every new session.

## Solution

### 1. MCP Server Instructions

Add an `instructions` field to the MCP server info in `src/server.ts`. This text is sent to Claude Code when the server connects, establishing behavioral rules.

**Instructions content:**

```
IMPORTANT: For ALL Android development tasks, you MUST use replicant-mcp tools first.
Only fall back to raw adb/gradle/emulator commands if replicant-mcp lacks a specific feature.

Tool mapping:
- Device management → adb-device (not `adb devices`)
- App install/launch/stop → adb-app (not `adb install`, `adb shell am`)
- Logs → adb-logcat (not `adb logcat`)
- Shell commands → adb-shell (not `adb shell`)
- Emulator control → emulator-device (not `emulator` CLI)
- Builds → gradle-build (not `./gradlew`)
- Tests → gradle-test (not `./gradlew test`)
- UI automation → ui (not `adb shell uiautomator` or `screencap`)

Start with `adb-device list` to see connected devices.
Use `rtfm` for detailed documentation on any tool.
```

**Implementation:**

Single change in `src/server.ts` - add `instructions` to the `Server` constructor's first argument alongside `name` and `version`.

### 2. Project-Relative Screenshot Path

Change default screenshot path from `/tmp/replicant-screenshot-{timestamp}.png` to `.replicant/screenshots/screenshot-{timestamp}.png` relative to current working directory.

**Changes:**

1. **`src/adapters/ui-automator.ts`** - Change default path logic:
   ```typescript
   // Before
   const localPath = options.localPath || `/tmp/replicant-screenshot-${Date.now()}.png`;

   // After
   const localPath = options.localPath || getDefaultScreenshotPath();
   ```

2. **New helper function** - Creates the directory if needed:
   ```typescript
   function getDefaultScreenshotPath(): string {
     const dir = path.join(process.cwd(), '.replicant', 'screenshots');
     fs.mkdirSync(dir, { recursive: true });
     return path.join(dir, `screenshot-${Date.now()}.png`);
   }
   ```

3. **`src/tools/ui.ts`** - Update `localPath` description from `/tmp/...` to `.replicant/screenshots/...`

## Testing

1. **MCP instructions** - Manual verification: start fresh Claude Code session, ask to "check connected Android devices" - should use `adb-device list` not `adb devices`

2. **Screenshot path** - Unit test: verify `getDefaultScreenshotPath()` creates directory and returns correct path. Integration test: take screenshot, verify file exists at `.replicant/screenshots/...`

## Edge Cases

- **Directory doesn't exist**: `mkdirSync` with `recursive: true` creates `.replicant/screenshots/` as needed
- **User provides explicit path**: Still honored via `options.localPath`
- **Running from root `/`**: Would fail on permissions - acceptable edge case

## Documentation Updates

- README: Add note about `.replicant/` directory, suggest adding to `.gitignore`
- rtfm `ui` docs: Update default screenshot path reference

## Files Changed

- `src/server.ts` - Add `instructions` field
- `src/adapters/ui-automator.ts` - New default screenshot path logic
- `src/tools/ui.ts` - Update localPath description
- `README.md` - Document `.replicant/` directory
