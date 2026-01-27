# Windows SDK/Tool Discovery Design

**Date:** 2026-01-26
**Issues:** replicant-mcp-dlt, replicant-mcp-kkm
**Status:** Approved

## Problem

SDK detection uses Unix paths and binary names. Windows executables (`adb.exe`, `emulator.exe`, `avdmanager.bat`) aren't handled, causing the server to fail on Windows.

## Solution

### 1. Executable Name Helper

Add `getExecutableName(baseName)` to `EnvironmentService`:

```typescript
private getExecutableName(baseName: string): string {
  if (os.platform() !== 'win32') {
    return baseName;
  }

  const windowsExtensions: Record<string, string> = {
    adb: '.exe',
    emulator: '.exe',
    avdmanager: '.bat',
  };

  return baseName + (windowsExtensions[baseName] || '.exe');
}
```

Used in `detect()`, `getAvdManagerPath()`, and `findSdkPath()`.

### 2. PATH Probing Fallback

Add `findAdbInPath()` as last-resort SDK discovery:

```typescript
private findAdbInPath(): string | null {
  const adbName = this.getExecutableName('adb');
  const pathEnv = process.env.PATH || '';
  const separator = os.platform() === 'win32' ? ';' : ':';

  for (const dir of pathEnv.split(separator)) {
    const candidate = path.join(dir, adbName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
```

When `adb` is found in PATH, derive SDK path by going up two levels from `platform-tools/adb`. Validate the derived path has expected SDK structure.

**Discovery order:**
1. `ANDROID_HOME` environment variable
2. `ANDROID_SDK_ROOT` environment variable
3. Common platform-specific paths
4. PATH probing (new fallback)

### 3. Windows CI

Add Windows job to GitHub Actions:

```yaml
test-windows:
  runs-on: windows-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm run build
    - run: npm test
```

No Android SDK installed initially. Tests that require real SDK should be mocked or skipped.

### 4. Unit Tests

Mock-based tests that validate Windows behavior on all platforms:

- Mock `os.platform()` to return `win32`
- Mock filesystem with Windows-style paths
- Verify `.exe`/`.bat` extensions are used
- Verify PATH splitting uses semicolon separator

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/environment.ts` | Add helper, PATH probing, use extensions |
| `tests/services/environment.test.ts` | Add Windows-specific test suite |
| `.github/workflows/ci.yml` | Add `test-windows` job |

## Edge Cases

- **Symlinked adb:** Validate derived SDK path has `platform-tools` directory
- **Standalone adb:** Same validation catches this case
- **Multiple SDKs in PATH:** First match wins (consistent with shell behavior)
