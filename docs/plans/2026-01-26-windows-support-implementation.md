# Windows SDK/Tool Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable replicant-mcp to work on Windows by handling `.exe`/`.bat` extensions and adding PATH fallback for SDK discovery.

**Architecture:** Add a private helper `getExecutableName()` that appends Windows extensions, integrate PATH probing as final fallback in `findSdkPath()`, and add a Windows CI job.

**Tech Stack:** TypeScript, Vitest, Node.js `os`/`fs`/`path` modules, GitHub Actions

---

### Task 1: Add Windows Executable Extension Tests

**Files:**
- Modify: `tests/services/environment.test.ts`

**Step 1: Write failing tests for Windows executable extensions**

Add this describe block after the existing tests (around line 129):

```typescript
describe("Windows support", () => {
  beforeEach(() => {
    service = new EnvironmentService();
    (service as any).cached = null;
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
  });

  it("uses .exe extension for adb on Windows", async () => {
    process.env.ANDROID_HOME = "C:\\Users\\test\\AppData\\Local\\Android\\Sdk";
    vi.mocked(os.platform).mockReturnValue("win32");
    vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return p === "C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
    });

    const env = await service.detect();

    expect(env.adbPath).toBe("C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe");
    expect(env.isValid).toBe(true);
  });

  it("uses .exe extension for emulator on Windows", async () => {
    process.env.ANDROID_HOME = "C:\\Users\\test\\AppData\\Local\\Android\\Sdk";
    vi.mocked(os.platform).mockReturnValue("win32");
    vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const validPaths = [
        "C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
        "C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe",
      ];
      return validPaths.includes(p as string);
    });

    const env = await service.detect();

    expect(env.emulatorPath).toBe("C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe");
  });

  it("probes Windows-specific paths when env vars not set", async () => {
    vi.mocked(os.platform).mockReturnValue("win32");
    vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
    process.env.LOCALAPPDATA = "C:\\Users\\test\\AppData\\Local";
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return p === "C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";
    });

    const env = await service.detect();

    expect(env.sdkPath).toBe("C:\\Users\\test\\AppData\\Local\\Android\\Sdk");
    expect(env.isValid).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/services/environment.test.ts`

Expected: 3 FAIL - tests expect `.exe` but current code doesn't add extensions

**Step 3: Commit the failing tests**

```bash
git add tests/services/environment.test.ts
git commit -m "test: add failing tests for Windows executable extensions"
```

---

### Task 2: Implement Executable Name Helper

**Files:**
- Modify: `src/services/environment.ts:40-42` (after imports, before class)

**Step 1: Add the helper method**

Add this private method inside `EnvironmentService` class (after `clearCache()` method, around line 178):

```typescript
private getExecutableName(baseName: string): string {
  if (os.platform() !== "win32") {
    return baseName;
  }

  const windowsExtensions: Record<string, string> = {
    adb: ".exe",
    emulator: ".exe",
    avdmanager: ".bat",
  };

  return baseName + (windowsExtensions[baseName] || ".exe");
}
```

**Step 2: Update detect() to use the helper**

Replace lines 41-42:
```typescript
const adbPath = path.join(sdkPath, "platform-tools", "adb");
const emulatorPath = path.join(sdkPath, "emulator", "emulator");
```

With:
```typescript
const adbPath = path.join(sdkPath, "platform-tools", this.getExecutableName("adb"));
const emulatorPath = path.join(sdkPath, "emulator", this.getExecutableName("emulator"));
```

**Step 3: Update findSdkPath() to use the helper**

Replace lines 121-122:
```typescript
const adbPath = path.join(process.env.ANDROID_HOME, "platform-tools", "adb");
```

With:
```typescript
const adbPath = path.join(process.env.ANDROID_HOME, "platform-tools", this.getExecutableName("adb"));
```

Do the same for lines 128-129 (ANDROID_SDK_ROOT check) and lines 137-138 (common paths loop).

**Step 4: Update getAvdManagerPath() to use the helper**

Replace line 100:
```typescript
const avdManagerPath = path.join(env.sdkPath, "cmdline-tools", "latest", "bin", "avdmanager");
```

With:
```typescript
const avdManagerPath = path.join(env.sdkPath, "cmdline-tools", "latest", "bin", this.getExecutableName("avdmanager"));
```

And line 102 (legacy path):
```typescript
const legacyPath = path.join(env.sdkPath, "tools", "bin", this.getExecutableName("avdmanager"));
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- --run tests/services/environment.test.ts`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/services/environment.ts
git commit -m "feat: add Windows executable extension handling

Add getExecutableName() helper that appends .exe/.bat for Windows.
Update all executable path construction to use the helper."
```

---

### Task 3: Add PATH Probing Tests

**Files:**
- Modify: `tests/services/environment.test.ts`

**Step 1: Add failing tests for PATH probing**

Add to the "Windows support" describe block:

```typescript
it("finds adb in PATH when SDK paths fail (Unix)", async () => {
  vi.mocked(os.platform).mockReturnValue("linux");
  vi.mocked(os.homedir).mockReturnValue("/home/test");
  process.env.PATH = "/usr/bin:/home/test/android-sdk/platform-tools";
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    // Only adb in PATH exists, not in standard locations
    return p === "/home/test/android-sdk/platform-tools/adb";
  });

  const env = await service.detect();

  expect(env.sdkPath).toBe("/home/test/android-sdk");
  expect(env.isValid).toBe(true);
});

it("finds adb in PATH when SDK paths fail (Windows)", async () => {
  vi.mocked(os.platform).mockReturnValue("win32");
  vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
  process.env.PATH = "C:\\Windows\\System32;C:\\android-sdk\\platform-tools";
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    return p === "C:\\android-sdk\\platform-tools\\adb.exe";
  });

  const env = await service.detect();

  expect(env.sdkPath).toBe("C:\\android-sdk");
  expect(env.isValid).toBe(true);
});

it("validates derived SDK path has platform-tools", async () => {
  vi.mocked(os.platform).mockReturnValue("linux");
  vi.mocked(os.homedir).mockReturnValue("/home/test");
  // adb is in /usr/local/bin (standalone, not in SDK)
  process.env.PATH = "/usr/local/bin";
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    // adb exists but parent doesn't have platform-tools structure
    if (p === "/usr/local/bin/adb") return true;
    if (p === "/usr/local/platform-tools") return false;
    return false;
  });

  const env = await service.detect();

  // Should NOT use standalone adb as SDK
  expect(env.isValid).toBe(false);
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/services/environment.test.ts`

Expected: 3 FAIL - PATH probing not implemented

**Step 3: Commit failing tests**

```bash
git add tests/services/environment.test.ts
git commit -m "test: add failing tests for PATH-based SDK discovery"
```

---

### Task 4: Implement PATH Probing

**Files:**
- Modify: `src/services/environment.ts`

**Step 1: Add findAdbInPath() method**

Add this private method after `getExecutableName()`:

```typescript
private findAdbInPath(): string | null {
  const adbName = this.getExecutableName("adb");
  const pathEnv = process.env.PATH || "";
  const separator = os.platform() === "win32" ? ";" : ":";

  for (const dir of pathEnv.split(separator)) {
    if (!dir) continue;
    const candidate = path.join(dir, adbName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
```

**Step 2: Add SDK validation helper**

Add this private method after `findAdbInPath()`:

```typescript
private isValidSdkPath(sdkPath: string): boolean {
  // Valid SDK should have platform-tools directory
  const platformToolsPath = path.join(sdkPath, "platform-tools");
  return fs.existsSync(platformToolsPath);
}
```

**Step 3: Update findSdkPath() to use PATH fallback**

Add before `return null;` at the end of `findSdkPath()` (around line 144):

```typescript
// 4. Probe PATH as last resort
const adbInPath = this.findAdbInPath();
if (adbInPath) {
  // adb is at <SDK>/platform-tools/adb, go up 2 levels
  const sdkPath = path.dirname(path.dirname(adbInPath));
  if (this.isValidSdkPath(sdkPath)) {
    return sdkPath;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/services/environment.test.ts`

Expected: All tests PASS

**Step 5: Run full test suite**

Run: `npm test -- --run`

Expected: All 258+ tests PASS

**Step 6: Commit**

```bash
git add src/services/environment.ts
git commit -m "feat: add PATH probing fallback for SDK discovery

When ANDROID_HOME, ANDROID_SDK_ROOT, and common paths all fail,
probe PATH for adb and derive SDK location from it.
Validates derived path has proper SDK structure."
```

---

### Task 5: Add Windows CI Job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add Windows test job**

Add this job after the `test` job (around line 48):

```yaml
  test-windows:
    runs-on: windows-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run unit tests
        run: npm test -- --run
```

**Step 2: Run linter (if present)**

Run: `npm run lint --if-present`

Expected: No errors

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Windows test runner

Run unit tests on windows-latest to catch platform-specific issues.
No Android SDK needed - tests use mocks."
```

---

### Task 6: Add avdmanager Windows Test

**Files:**
- Modify: `tests/services/environment.test.ts`

**Step 1: Add test for avdmanager.bat**

Add to the "Windows support" describe block:

```typescript
it("uses .bat extension for avdmanager on Windows", async () => {
  process.env.ANDROID_HOME = "C:\\Users\\test\\AppData\\Local\\Android\\Sdk";
  vi.mocked(os.platform).mockReturnValue("win32");
  vi.mocked(os.homedir).mockReturnValue("C:\\Users\\test");
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const validPaths = [
      "C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
      "C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\cmdline-tools\\latest\\bin\\avdmanager.bat",
    ];
    return validPaths.includes(p as string);
  });

  const avdManagerPath = await service.getAvdManagerPath();

  expect(avdManagerPath).toBe("C:\\Users\\test\\AppData\\Local\\Android\\Sdk\\cmdline-tools\\latest\\bin\\avdmanager.bat");
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --run tests/services/environment.test.ts`

Expected: All tests PASS (implementation already done in Task 2)

**Step 3: Commit**

```bash
git add tests/services/environment.test.ts
git commit -m "test: add avdmanager.bat extension test for Windows"
```

---

### Task 7: Update Beads Issues

**Step 1: Close the Windows support issue**

Run: `bd close replicant-mcp-dlt --reason="Implemented Windows executable extensions and PATH probing"`

**Step 2: Close the PATH probing issue**

Run: `bd close replicant-mcp-kkm --reason="Bundled with Windows support fix"`

**Step 3: Verify issues closed**

Run: `bd list --status=closed | grep -E "(dlt|kkm)"`

Expected: Both issues show as closed

---

### Task 8: Final Verification and PR

**Step 1: Run full test suite**

Run: `npm test -- --run`

Expected: All tests PASS

**Step 2: Build**

Run: `npm run build`

Expected: No errors

**Step 3: Push branch**

Run: `git push -u origin fix/windows-support`

**Step 4: Create PR**

```bash
gh pr create --title "fix: Windows SDK and PATH discovery support" --body "$(cat <<'EOF'
## Summary
- Add `.exe`/`.bat` extensions for Windows executables (adb.exe, emulator.exe, avdmanager.bat)
- Add PATH probing as fallback when SDK environment variables and common paths fail
- Add Windows CI runner for cross-platform validation

## Test plan
- [x] Unit tests for Windows executable extensions
- [x] Unit tests for PATH probing on Unix and Windows
- [x] Unit tests for SDK path validation
- [x] Windows CI job added to workflow
- [x] All 258+ existing tests still pass

Closes: replicant-mcp-dlt, replicant-mcp-kkm

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 5: Monitor for Greptile review and address feedback**

Wait for Greptile review. Address any feedback by pushing additional commits.
