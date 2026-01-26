# Sandbox-Safe Screenshot Path

**Issue:** replicant-mcp-zwm
**Date:** 2026-01-26
**Status:** Approved

## Problem

In Claude Desktop's sandboxed environment, `process.cwd()` returns `/` (filesystem root), which isn't writable. This causes:

```
ENOENT: no such file or directory, mkdir '/.replicant/screenshots'
```

## Solution

Update `getDefaultScreenshotPath()` to detect the sandbox environment and fall back to the user's home directory.

**Behavior:**
- Normal environment: `{cwd}/.replicant/screenshots/`
- Sandbox (cwd is `/`): `~/.replicant/screenshots/`

This follows the standard pattern used by other CLI tools (`.npm`, `.gradle`, `.android`).

## Implementation

**File:** `src/adapters/ui-automator.ts`

```typescript
import * as os from 'os';

/**
 * Get default screenshot path in .replicant/screenshots directory.
 * Creates the directory if it doesn't exist.
 *
 * In sandboxed environments (Claude Desktop), process.cwd() returns '/'
 * which isn't writable, so we fall back to the user's home directory.
 *
 * @param baseDir - Override base directory (for testing)
 */
function getDefaultScreenshotPath(baseDir?: string): string {
  const effectiveBaseDir = baseDir ?? (process.cwd() === '/' ? os.homedir() : process.cwd());
  const dir = path.join(effectiveBaseDir, '.replicant', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `screenshot-${Date.now()}.png`);
}
```

## Testing

**File:** `tests/adapters/ui-automator.test.ts`

Uses injectable `baseDir` parameter - no global mocks needed, CI-safe.

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("getDefaultScreenshotPath", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replicant-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates screenshot in provided base directory", () => {
    const result = getDefaultScreenshotPath(tempDir);

    expect(result).toContain(path.join(tempDir, '.replicant', 'screenshots'));
    expect(result).toMatch(/screenshot-\d+\.png$/);
    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });

  it("creates nested directories if they don't exist", () => {
    const nestedBase = path.join(tempDir, 'deep', 'nested');

    const result = getDefaultScreenshotPath(nestedBase);

    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });
});
```

**Note:** The sandbox fallback logic (`process.cwd() === '/'`) is tested implicitly - when no `baseDir` is provided in a sandbox environment, `os.homedir()` is used. This behavior is validated by the integration test (actual Claude Desktop usage).

## Release

Patch version bump: 1.4.0 → 1.4.1
