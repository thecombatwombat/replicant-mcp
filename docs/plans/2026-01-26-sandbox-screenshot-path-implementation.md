# Sandbox-Safe Screenshot Path Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix ENOENT error when taking screenshots in Claude Desktop's sandboxed environment where `process.cwd()` returns `/`.

**Architecture:** Extract `getDefaultScreenshotPath()` to a utility module, add sandbox detection with `os.homedir()` fallback, make `baseDir` injectable for testing.

**Tech Stack:** TypeScript, Vitest, Node.js fs/os modules

---

## Task 1: Create Path Utility Module with Tests

**Files:**
- Create: `src/utils/paths.ts`
- Create: `tests/utils/paths.test.ts`

**Step 1: Write the failing test**

Create `tests/utils/paths.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getDefaultScreenshotPath } from "../../src/utils/paths.js";

describe("getDefaultScreenshotPath", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "replicant-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates screenshot path in provided base directory", () => {
    const result = getDefaultScreenshotPath(tempDir);

    expect(result).toContain(path.join(tempDir, ".replicant", "screenshots"));
    expect(result).toMatch(/screenshot-\d+\.png$/);
    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });

  it("creates nested directories if they do not exist", () => {
    const nestedBase = path.join(tempDir, "deep", "nested");

    const result = getDefaultScreenshotPath(nestedBase);

    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });

  it("generates unique filenames with timestamps", () => {
    const result1 = getDefaultScreenshotPath(tempDir);
    const result2 = getDefaultScreenshotPath(tempDir);

    expect(result1).not.toBe(result2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils/paths.test.ts`
Expected: FAIL with "Cannot find module '../../src/utils/paths.js'"

**Step 3: Write minimal implementation**

Create `src/utils/paths.ts`:

```typescript
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

/**
 * Get default screenshot path in .replicant/screenshots directory.
 * Creates the directory if it doesn't exist.
 *
 * In sandboxed environments (Claude Desktop), process.cwd() returns '/'
 * which isn't writable, so we fall back to the user's home directory.
 *
 * @param baseDir - Override base directory (for testing). If not provided,
 *                  uses process.cwd() or os.homedir() in sandbox environments.
 */
export function getDefaultScreenshotPath(baseDir?: string): string {
  const effectiveBaseDir = baseDir ?? (process.cwd() === "/" ? os.homedir() : process.cwd());
  const dir = path.join(effectiveBaseDir, ".replicant", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `screenshot-${Date.now()}.png`);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/utils/paths.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/utils/paths.ts tests/utils/paths.test.ts
git commit -m "feat: add sandbox-safe screenshot path utility

Extract getDefaultScreenshotPath to utility module with:
- os.homedir() fallback when process.cwd() is '/' (sandbox)
- Injectable baseDir parameter for CI-safe testing

Part of fix for replicant-mcp-zwm"
```

---

## Task 2: Update UiAutomatorAdapter to Use New Utility

**Files:**
- Modify: `src/adapters/ui-automator.ts:76-80` (remove old function)
- Modify: `src/adapters/ui-automator.ts:1-10` (add import)

**Step 1: Add import for new utility**

In `src/adapters/ui-automator.ts`, add import after line 22:

```typescript
import { getDefaultScreenshotPath } from "../utils/paths.js";
```

**Step 2: Remove old function**

Delete lines 72-80 (the old `getDefaultScreenshotPath` function and its JSDoc comment):

```typescript
// DELETE THIS:
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

**Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (all 250 tests)

**Step 4: Commit**

```bash
git add src/adapters/ui-automator.ts
git commit -m "refactor: use shared path utility in UiAutomatorAdapter

Replace inline getDefaultScreenshotPath with import from utils/paths.
No behavior change for normal environments; fixes sandbox (cwd='/').

Fixes replicant-mcp-zwm"
```

---

## Task 3: Final Verification and PR

**Step 1: Run full test suite**

Run: `npm test`
Expected: PASS (250 tests)

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build, no errors

**Step 3: Manual verification (optional)**

If Claude Desktop is available, test screenshot in sandbox environment.

**Step 4: Push and create PR**

```bash
git push -u origin fix/sandbox-screenshot-path
```

Create PR with:
- Title: `fix: sandbox-safe screenshot path for Claude Desktop`
- Reference: `Fixes replicant-mcp-zwm`
