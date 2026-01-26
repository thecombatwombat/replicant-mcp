# Inline Screenshot Scaling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix inline screenshots to use scaling + JPEG compression, reducing size from 1.9MB to ~108KB

**Architecture:** Pull PNG to temp file → scale with sharp → convert to JPEG q70 → base64 encode → update scalingState → return

**Tech Stack:** TypeScript, sharp, vitest

---

## Task 1: Update ScreenshotResult Type

**Files:**
- Modify: `src/adapters/ui-automator.ts:41-50`

**Step 1: Write the failing test**

```typescript
// In tests/adapters/ui-automator.test.ts, add to the screenshot describe block:

it("returns mimeType field for inline screenshots", async () => {
  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  const result = await adapter.screenshot("emulator-5554", { inline: true });

  expect(result.mimeType).toBe("image/jpeg");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "returns mimeType"`
Expected: FAIL - `mimeType` is undefined

**Step 3: Update the ScreenshotResult type**

In `src/adapters/ui-automator.ts`, update the interface at line 41:

```typescript
export interface ScreenshotResult {
  mode: "file" | "inline";
  path?: string;
  base64?: string;
  mimeType?: string;  // Add this line
  sizeBytes?: number;
  device?: { width: number; height: number };
  image?: { width: number; height: number };
  scaleFactor?: number;
  warning?: string;
}
```

**Step 4: Run test to verify it still fails**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "returns mimeType"`
Expected: FAIL - type exists but value still undefined (implementation not done yet)

**Step 5: Commit type change**

```bash
git add src/adapters/ui-automator.ts
git commit -m "feat(types): add mimeType to ScreenshotResult"
```

---

## Task 2: Add os import

**Files:**
- Modify: `src/adapters/ui-automator.ts:1`

**Step 1: Add the import**

At the top of `src/adapters/ui-automator.ts`, add:

```typescript
import * as os from "os";
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/adapters/ui-automator.ts
git commit -m "chore: add os import for temp directory"
```

---

## Task 3: Implement Inline Screenshot Scaling

**Files:**
- Modify: `src/adapters/ui-automator.ts:229-239`
- Test: `tests/adapters/ui-automator.test.ts`

**Step 1: Write the failing test for size reduction**

```typescript
// In tests/adapters/ui-automator.test.ts, add:

it("returns scaled JPEG for inline screenshots under 200KB", async () => {
  // Mock sharp to return a buffer
  const mockBuffer = Buffer.alloc(50000); // 50KB mock JPEG
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(mockBuffer),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  const result = await adapter.screenshot("emulator-5554", { inline: true });

  expect(result.mode).toBe("inline");
  expect(result.mimeType).toBe("image/jpeg");
  expect(result.sizeBytes).toBeLessThan(200000);
  expect(result.base64).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "scaled JPEG"`
Expected: FAIL

**Step 3: Write the implementation**

Replace lines 229-239 in `src/adapters/ui-automator.ts`:

```typescript
if (options.inline) {
  // Inline mode: pull to temp, scale, convert to JPEG, return base64
  const tempPath = path.join(os.tmpdir(), `replicant-inline-${Date.now()}.png`);

  try {
    // Pull to temp file
    await this.adb.pull(deviceId, remotePath, tempPath);

    // Get dimensions
    const metadata = await sharp(tempPath).metadata();
    const deviceWidth = metadata.width!;
    const deviceHeight = metadata.height!;

    // Calculate scale factor
    const scaleFactor = calculateScaleFactor(deviceWidth, deviceHeight, maxDimension);
    const imageWidth = Math.round(deviceWidth / scaleFactor);
    const imageHeight = Math.round(deviceHeight / scaleFactor);

    // Scale and convert to JPEG
    const buffer = await sharp(tempPath)
      .resize(imageWidth, imageHeight)
      .jpeg({ quality: 70 })
      .toBuffer();

    // Update scaling state (now supported for inline!)
    this.scalingState = {
      scaleFactor,
      deviceWidth,
      deviceHeight,
      imageWidth,
      imageHeight,
    };

    return {
      mode: "inline",
      base64: buffer.toString("base64"),
      mimeType: "image/jpeg",
      sizeBytes: buffer.length,
      device: { width: deviceWidth, height: deviceHeight },
      image: { width: imageWidth, height: imageHeight },
      scaleFactor,
    };
  } finally {
    // Clean up temp file
    const fsPromises = await import("fs/promises");
    await fsPromises.unlink(tempPath).catch(() => {});
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "scaled JPEG"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/ui-automator.ts tests/adapters/ui-automator.test.ts
git commit -m "feat: implement inline screenshot scaling with JPEG compression

- Pull to temp file instead of base64 on device
- Scale with sharp to maxDimension (default 1000)
- Convert to JPEG q70 for ~94% size reduction
- Update scalingState for coordinate conversion
- Return consistent dimension fields

Fixes: replicant-mcp-wl1"
```

---

## Task 4: Test Dimension Reporting Accuracy

**Files:**
- Test: `tests/adapters/ui-automator.test.ts`

**Step 1: Write the test**

```typescript
it("reports correct device and image dimensions for inline screenshots", async () => {
  const mockBuffer = Buffer.alloc(50000);
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(mockBuffer),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  const result = await adapter.screenshot("emulator-5554", { inline: true, maxDimension: 1000 });

  expect(result.device).toEqual({ width: 1080, height: 2400 });
  expect(result.image).toEqual({ width: 450, height: 1000 });
  expect(result.scaleFactor).toBe(2.4);
});
```

**Step 2: Run test**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "reports correct device"`
Expected: PASS (implementation already done)

**Step 3: Commit**

```bash
git add tests/adapters/ui-automator.test.ts
git commit -m "test: verify inline screenshot dimension reporting"
```

---

## Task 5: Scaling State Regression Guard (CRITICAL)

**Files:**
- Test: `tests/adapters/ui-automator.test.ts`

**Step 1: Write the regression guard test**

```typescript
it("sets scalingState after inline screenshot_REGRESSION_wl1", async () => {
  const mockBuffer = Buffer.alloc(50000);
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(mockBuffer),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  await adapter.screenshot("emulator-5554", { inline: true });

  // CRITICAL: This must NOT be null - inline mode now sets scaling state
  const state = adapter.getScalingState();
  expect(state).not.toBeNull();
  expect(state!.scaleFactor).toBe(2.4);
  expect(state!.deviceWidth).toBe(1080);
  expect(state!.deviceHeight).toBe(2400);
});
```

**Step 2: Run test**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "REGRESSION_wl1"`
Expected: PASS

**Step 3: Remove the old test that expected null scaling state**

Find and update the test "clears scaling state when inline mode requested" - it should now verify scaling state is SET, not cleared.

**Step 4: Commit**

```bash
git add tests/adapters/ui-automator.test.ts
git commit -m "test: add scaling state regression guard for inline screenshots

REGRESSION_wl1: Inline mode must set scalingState for coordinate conversion"
```

---

## Task 6: Consistency Contract Test

**Files:**
- Test: `tests/adapters/ui-automator.test.ts`

**Step 1: Write the contract test**

```typescript
it("inline and file mode return consistent dimension fields", async () => {
  const mockBuffer = Buffer.alloc(50000);
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(mockBuffer),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  const inlineResult = await adapter.screenshot("emulator-5554", { inline: true, maxDimension: 1000 });
  const fileResult = await adapter.screenshot("emulator-5554", { localPath: "/tmp/test.png", maxDimension: 1000 });

  // These fields must match between modes
  expect(inlineResult.device).toEqual(fileResult.device);
  expect(inlineResult.image).toEqual(fileResult.image);
  expect(inlineResult.scaleFactor).toEqual(fileResult.scaleFactor);
});
```

**Step 2: Run test**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "consistent dimension"`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/adapters/ui-automator.test.ts
git commit -m "test: add consistency contract between inline and file modes"
```

---

## Task 7: No Partial State on Error

**Files:**
- Test: `tests/adapters/ui-automator.test.ts`

**Step 1: Write the test**

```typescript
it("does not update scalingState when sharp fails", async () => {
  // First set a known scaling state
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.alloc(1000)),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  await adapter.screenshot("emulator-5554", { inline: true });
  const originalState = adapter.getScalingState();

  // Now make sharp fail
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockRejectedValue(new Error("Sharp failed")),
  } as any));

  await expect(
    adapter.screenshot("emulator-5554", { inline: true })
  ).rejects.toThrow("Sharp failed");

  // Scaling state should remain unchanged (not corrupted)
  expect(adapter.getScalingState()).toEqual(originalState);
});
```

**Step 2: Run test**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "does not update scalingState when sharp fails"`
Expected: FAIL - current implementation updates state before potential failure

**Step 3: Fix implementation if needed**

The implementation in Task 3 already handles this correctly - `scalingState` is only updated after `sharp().toBuffer()` succeeds. If test fails, the implementation needs adjustment.

**Step 4: Run test to verify**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "does not update scalingState when sharp fails"`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/adapters/ui-automator.test.ts
git commit -m "test: verify scalingState unchanged on sharp failure"
```

---

## Task 8: Temp File Cleanup on Success

**Files:**
- Test: `tests/adapters/ui-automator.test.ts`

**Step 1: Write the test**

```typescript
it("cleans up temp file after successful inline screenshot", async () => {
  const mockUnlink = vi.fn().mockResolvedValue(undefined);
  vi.doMock("fs/promises", () => ({
    readFile: vi.fn(),
    unlink: mockUnlink,
    rename: vi.fn().mockResolvedValue(undefined),
  }));

  const mockBuffer = Buffer.alloc(50000);
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(mockBuffer),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  await adapter.screenshot("emulator-5554", { inline: true });

  // Verify unlink was called with a temp path
  const fsPromises = await import("fs/promises");
  expect(fsPromises.unlink).toHaveBeenCalledWith(
    expect.stringMatching(/replicant-inline-\d+\.png$/)
  );
});
```

**Step 2: Run test**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "cleans up temp file after successful"`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/adapters/ui-automator.test.ts
git commit -m "test: verify temp file cleanup on successful inline screenshot"
```

---

## Task 9: Temp File Cleanup on Error

**Files:**
- Test: `tests/adapters/ui-automator.test.ts`

**Step 1: Write the test**

```typescript
it("cleans up temp file even when sharp throws", async () => {
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockRejectedValue(new Error("Sharp exploded")),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  await expect(
    adapter.screenshot("emulator-5554", { inline: true })
  ).rejects.toThrow("Sharp exploded");

  // Verify unlink was still called (cleanup in finally block)
  const fsPromises = await import("fs/promises");
  expect(fsPromises.unlink).toHaveBeenCalled();
});
```

**Step 2: Run test**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "cleans up temp file even when sharp throws"`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/adapters/ui-automator.test.ts
git commit -m "test: verify temp file cleanup on sharp failure"
```

---

## Task 10: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Final commit if any changes needed**

```bash
git status
# If clean, skip. Otherwise commit any remaining changes.
```

---

## Task 11: Update Old Test

**Files:**
- Modify: `tests/adapters/ui-automator.test.ts`

**Step 1: Find and update the old test**

The test "clears scaling state when inline mode requested" (lines 141-161) is now incorrect. Update it to verify scaling state IS set:

```typescript
it("sets scaling state when inline mode requested", async () => {
  const mockBuffer = Buffer.alloc(50000);
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(mockBuffer),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  await adapter.screenshot("emulator-5554", { inline: true });

  // Verify scaling state IS set (previously was cleared - this changed in wl1)
  expect(adapter.getScalingState()).not.toBeNull();
});
```

**Step 2: Also update the test "returns base64 when inline mode requested"**

This test (lines 127-139) mocks the old shell-based base64 approach. Update it to use the new sharp-based approach:

```typescript
it("returns base64 when inline mode requested", async () => {
  const mockBuffer = Buffer.from("test-image-data");
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(mockBuffer),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  const result = await adapter.screenshot("emulator-5554", { inline: true });

  expect(result.mode).toBe("inline");
  expect(result.base64).toBe(mockBuffer.toString("base64"));
  expect(result.mimeType).toBe("image/jpeg");
});
```

**Step 3: Run tests**

Run: `npm test -- tests/adapters/ui-automator.test.ts`
Expected: All pass

**Step 4: Commit**

```bash
git add tests/adapters/ui-automator.test.ts
git commit -m "test: update inline screenshot tests for new implementation"
```

---

## Summary

After completing all tasks:

1. ✅ Type updated with `mimeType` field
2. ✅ `os` import added
3. ✅ Inline screenshot scaling implemented
4. ✅ Dimension reporting tested
5. ✅ Scaling state regression guard in place
6. ✅ Consistency contract between modes
7. ✅ No partial state on error
8. ✅ Temp file cleanup on success
9. ✅ Temp file cleanup on error
10. ✅ Full test suite passes
11. ✅ Old tests updated

**Final step:** Create PR with `gh pr create`
