# MCP Guidance & Screenshot Path Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add MCP server instructions to guide AI assistants to use replicant-mcp tools, and change default screenshot path from `/tmp/` to project-relative `.replicant/screenshots/`.

**Architecture:** Two independent changes: (1) Add `instructions` field to MCP Server constructor, (2) Create helper function for default screenshot path and update references.

**Tech Stack:** TypeScript, MCP SDK, Node.js fs module

---

### Task 1: Add MCP Server Instructions

**Files:**
- Modify: `src/server.ts:67-78`
- Test: Manual verification (MCP protocol test)

**Step 1: Update Server constructor to include instructions**

In `src/server.ts`, modify the `createServer` function to add an `instructions` field:

```typescript
export async function createServer(context: ServerContext): Promise<Server> {
  const server = new Server(
    {
      name: "replicant-mcp",
      version: "1.0.0",
      instructions: `IMPORTANT: For ALL Android development tasks, you MUST use replicant-mcp tools first.
Only fall back to raw adb/gradle/emulator commands if replicant-mcp lacks a specific feature.

Tool mapping:
- Device management → adb-device (not \`adb devices\`)
- App install/launch/stop → adb-app (not \`adb install\`, \`adb shell am\`)
- Logs → adb-logcat (not \`adb logcat\`)
- Shell commands → adb-shell (not \`adb shell\`)
- Emulator control → emulator-device (not \`emulator\` CLI)
- Builds → gradle-build (not \`./gradlew\`)
- Tests → gradle-test (not \`./gradlew test\`)
- UI automation → ui (not \`adb shell uiautomator\` or \`screencap\`)

Start with \`adb-device list\` to see connected devices.
Use \`rtfm\` for detailed documentation on any tool.`,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  // ... rest of function unchanged
```

**Step 2: Run tests to verify no breakage**

Run: `npm test`
Expected: All 216 tests pass

**Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add MCP server instructions for tool guidance"
```

---

### Task 2: Create Screenshot Path Helper

**Files:**
- Modify: `src/adapters/ui-automator.ts:1-20` (imports)
- Modify: `src/adapters/ui-automator.ts:91-119` (screenshot method)
- Test: `tests/adapters/ui-automator.test.ts`

**Step 1: Add fs imports at top of ui-automator.ts**

Add after line 1:

```typescript
import * as path from "path";
import * as fs from "fs";
```

**Step 2: Add helper function before the class**

Add before the `UiAutomatorAdapter` class (around line 48):

```typescript
/**
 * Get default screenshot path in project-relative .replicant/screenshots directory.
 * Creates the directory if it doesn't exist.
 */
function getDefaultScreenshotPath(): string {
  const dir = path.join(process.cwd(), ".replicant", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `screenshot-${Date.now()}.png`);
}
```

**Step 3: Update screenshot method to use helper**

Change line 116 from:

```typescript
const localPath = options.localPath || `/tmp/replicant-screenshot-${Date.now()}.png`;
```

To:

```typescript
const localPath = options.localPath || getDefaultScreenshotPath();
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass (existing tests mock adb.pull so path doesn't matter)

**Step 5: Commit**

```bash
git add src/adapters/ui-automator.ts
git commit -m "feat: change default screenshot path to .replicant/screenshots/"
```

---

### Task 3: Update Tool Description

**Files:**
- Modify: `src/tools/ui.ts:425`

**Step 1: Update localPath description**

Change line 425 from:

```typescript
localPath: { type: "string", description: "Local path for screenshot (default: /tmp/replicant-screenshot-{timestamp}.png)" },
```

To:

```typescript
localPath: { type: "string", description: "Local path for screenshot (default: .replicant/screenshots/screenshot-{timestamp}.png)" },
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/tools/ui.ts
git commit -m "docs: update screenshot path in tool description"
```

---

### Task 4: Update README Documentation

**Files:**
- Modify: `README.md`

**Step 1: Add .replicant directory note**

Find the "Configuration" section or add after "Quick Start". Add:

```markdown
### Output Directory

replicant-mcp stores screenshots in `.replicant/screenshots/` within your current working directory. Add this to your `.gitignore`:

```gitignore
.replicant/
```
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document .replicant/ output directory"
```

---

### Task 5: Final Verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All 216 tests pass

**Step 2: Build the project**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Manual verification of instructions**

Run: `node -e "const {Server} = require('@modelcontextprotocol/sdk/server'); console.log('SDK loaded')"`
Expected: "SDK loaded" (verifies SDK accepts instructions field)

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/server.ts` | Add `instructions` field to Server constructor |
| `src/adapters/ui-automator.ts` | Add imports, helper function, update default path |
| `src/tools/ui.ts` | Update localPath description |
| `README.md` | Document .replicant/ directory |

**Total commits:** 4
