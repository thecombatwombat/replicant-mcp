# Screenshot Scaling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically scale screenshots to prevent API dimension limits (2000px) and reduce token usage, with transparent coordinate conversion.

**Architecture:** Screenshots scaled to fit within configurable max dimension (default 1000px). Scaling state stored per-adapter. All coordinates (dump bounds, find results, tap inputs) transparently converted between image space and device space.

**Tech Stack:** sharp (image resizing), vitest (testing)

---

## Task 1: Scale Factor Calculation

**Files:**
- Create: `src/services/scaling.ts`
- Create: `tests/services/scaling.test.ts`

**Step 1: Write the failing test for calculateScaleFactor**

```typescript
// tests/services/scaling.test.ts
import { describe, it, expect } from "vitest";
import { calculateScaleFactor } from "../../src/services/scaling.js";

describe("calculateScaleFactor", () => {
  it("returns 1.0 when device fits within max dimension", () => {
    const result = calculateScaleFactor(800, 600, 1000);
    expect(result).toBe(1.0);
  });

  it("scales based on height when height is longest side", () => {
    const result = calculateScaleFactor(1080, 2400, 1000);
    expect(result).toBe(2.4);
  });

  it("scales based on width when width is longest side (landscape)", () => {
    const result = calculateScaleFactor(2400, 1080, 1000);
    expect(result).toBe(2.4);
  });

  it("uses custom max dimension", () => {
    const result = calculateScaleFactor(1080, 2400, 1500);
    expect(result).toBe(1.6);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/scaling.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/services/scaling.ts
/**
 * Calculate the scale factor needed to fit device dimensions within max dimension.
 * Returns 1.0 if no scaling needed.
 */
export function calculateScaleFactor(
  deviceWidth: number,
  deviceHeight: number,
  maxDimension: number
): number {
  const longestSide = Math.max(deviceWidth, deviceHeight);
  if (longestSide <= maxDimension) {
    return 1.0;
  }
  return longestSide / maxDimension;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/services/scaling.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/services/scaling.ts tests/services/scaling.test.ts
git commit -m "feat(scaling): add calculateScaleFactor function"
```

---

## Task 2: Coordinate Conversion Helpers

**Files:**
- Modify: `src/services/scaling.ts`
- Modify: `tests/services/scaling.test.ts`

**Step 1: Write failing tests for coordinate conversion**

Add to `tests/services/scaling.test.ts`:

```typescript
import { calculateScaleFactor, toImageSpace, toDeviceSpace, boundsToImageSpace } from "../../src/services/scaling.js";

describe("toImageSpace", () => {
  it("converts device coordinates to image coordinates", () => {
    const result = toImageSpace(480, 1200, 2.4);
    expect(result).toEqual({ x: 200, y: 500 });
  });

  it("returns same coordinates when scale factor is 1.0", () => {
    const result = toImageSpace(480, 1200, 1.0);
    expect(result).toEqual({ x: 480, y: 1200 });
  });

  it("rounds to nearest integer", () => {
    const result = toImageSpace(100, 100, 3);
    expect(result).toEqual({ x: 33, y: 33 });
  });
});

describe("toDeviceSpace", () => {
  it("converts image coordinates to device coordinates", () => {
    const result = toDeviceSpace(200, 500, 2.4);
    expect(result).toEqual({ x: 480, y: 1200 });
  });

  it("returns same coordinates when scale factor is 1.0", () => {
    const result = toDeviceSpace(200, 500, 1.0);
    expect(result).toEqual({ x: 200, y: 500 });
  });

  it("rounds to nearest integer", () => {
    const result = toDeviceSpace(33, 33, 3);
    expect(result).toEqual({ x: 99, y: 99 });
  });
});

describe("boundsToImageSpace", () => {
  it("converts all four corners", () => {
    const bounds = { left: 240, top: 480, right: 480, bottom: 720 };
    const result = boundsToImageSpace(bounds, 2.4);
    expect(result).toEqual({ left: 100, top: 200, right: 200, bottom: 300 });
  });

  it("returns same bounds when scale factor is 1.0", () => {
    const bounds = { left: 100, top: 200, right: 300, bottom: 400 };
    const result = boundsToImageSpace(bounds, 1.0);
    expect(result).toEqual(bounds);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/scaling.test.ts`
Expected: FAIL with "toImageSpace is not exported"

**Step 3: Write minimal implementation**

Add to `src/services/scaling.ts`:

```typescript
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Convert device coordinates to image coordinates.
 */
export function toImageSpace(
  deviceX: number,
  deviceY: number,
  scaleFactor: number
): { x: number; y: number } {
  if (scaleFactor === 1.0) {
    return { x: deviceX, y: deviceY };
  }
  return {
    x: Math.round(deviceX / scaleFactor),
    y: Math.round(deviceY / scaleFactor),
  };
}

/**
 * Convert image coordinates to device coordinates.
 */
export function toDeviceSpace(
  imageX: number,
  imageY: number,
  scaleFactor: number
): { x: number; y: number } {
  if (scaleFactor === 1.0) {
    return { x: imageX, y: imageY };
  }
  return {
    x: Math.round(imageX * scaleFactor),
    y: Math.round(imageY * scaleFactor),
  };
}

/**
 * Convert bounds from device space to image space.
 */
export function boundsToImageSpace(bounds: Bounds, scaleFactor: number): Bounds {
  if (scaleFactor === 1.0) {
    return bounds;
  }
  return {
    left: Math.round(bounds.left / scaleFactor),
    top: Math.round(bounds.top / scaleFactor),
    right: Math.round(bounds.right / scaleFactor),
    bottom: Math.round(bounds.bottom / scaleFactor),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/services/scaling.test.ts`
Expected: PASS (10 tests)

**Step 5: Commit**

```bash
git add src/services/scaling.ts tests/services/scaling.test.ts
git commit -m "feat(scaling): add coordinate conversion helpers"
```

---

## Task 3: Add Scaling Configuration

**Files:**
- Modify: `src/types/config.ts`
- Modify: `src/tools/ui.ts` (inline default)

**Step 1: Update UiConfig interface**

In `src/types/config.ts`, add to `UiConfig`:

```typescript
export interface UiConfig {
  /** Always skip accessibility and use visual mode for these packages */
  visualModePackages: string[];
  /** Auto-include screenshot when find returns no results (default: true) */
  autoFallbackScreenshot: boolean;
  /** Include base64-encoded screenshot in response (default: false) */
  includeBase64: boolean;
  /** Maximum dimension (width or height) for screenshots in pixels (default: 1000) */
  maxImageDimension: number;
}
```

**Step 2: Update DEFAULT_CONFIG**

In `src/types/config.ts`, add to default:

```typescript
export const DEFAULT_CONFIG: ReplicantConfig = {
  ui: {
    visualModePackages: [],
    autoFallbackScreenshot: true,
    includeBase64: false,
    maxImageDimension: 1000,
  },
};
```

**Step 3: Update inline default in ui.ts**

In `src/tools/ui.ts`, find the inline config default (around line 124) and add:

```typescript
const config = uiConfig ?? {
  visualModePackages: [],
  autoFallbackScreenshot: true,
  includeBase64: false,
  maxImageDimension: 1000,
};
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: PASS (no type errors)

**Step 5: Commit**

```bash
git add src/types/config.ts src/tools/ui.ts
git commit -m "feat(scaling): add maxImageDimension config option"
```

---

## Task 4: Add Scaling State to UiAutomatorAdapter

**Files:**
- Modify: `src/adapters/ui-automator.ts`

**Step 1: Add ScalingState interface and class field**

At the top of `src/adapters/ui-automator.ts`, after the imports, add:

```typescript
/**
 * Tracks the current scaling state between device and image coordinates.
 * Updated on every screenshot operation.
 */
export interface ScalingState {
  scaleFactor: number;
  deviceWidth: number;
  deviceHeight: number;
  imageWidth: number;
  imageHeight: number;
}
```

**Step 2: Add private field to UiAutomatorAdapter class**

In the `UiAutomatorAdapter` class, add after constructor:

```typescript
export class UiAutomatorAdapter {
  private scalingState: ScalingState | null = null;

  constructor(private adb: AdbAdapter = new AdbAdapter()) {}

  // Add getter for tests
  getScalingState(): ScalingState | null {
    return this.scalingState;
  }

  // ... rest of class
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/adapters/ui-automator.ts
git commit -m "feat(scaling): add ScalingState interface and field"
```

---

## Task 5: Implement Screenshot Scaling

**Files:**
- Modify: `src/adapters/ui-automator.ts`
- Modify: `tests/adapters/ui-automator.test.ts`

**Step 1: Write failing test for scaled screenshot**

Add to `tests/adapters/ui-automator.test.ts` in the `describe("screenshot")` block:

```typescript
// At top of file, add sharp mock
vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  })),
}));
import sharp from "sharp";

// In describe("screenshot") block:
it("scales screenshot when device exceeds max dimension", async () => {
  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  const result = await adapter.screenshot("emulator-5554", {
    localPath: "/tmp/test.png",
    maxDimension: 1000,
  });

  expect(result.mode).toBe("file");
  expect(result.device).toEqual({ width: 1080, height: 2400 });
  expect(result.image).toEqual({ width: 450, height: 1000 });
  expect(result.scaleFactor).toBe(2.4);
  expect(sharp).toHaveBeenCalled();
});

it("skips scaling when raw=true", async () => {
  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  const result = await adapter.screenshot("emulator-5554", {
    localPath: "/tmp/test.png",
    raw: true,
  });

  expect(result.scaleFactor).toBe(1.0);
  expect(result.warning).toContain("Raw mode");
});

it("skips scaling when device fits within max dimension", async () => {
  vi.mocked(sharp).mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    resize: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  } as any));

  mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  mockAdb.pull.mockResolvedValue(undefined);

  const result = await adapter.screenshot("emulator-5554", {
    localPath: "/tmp/test.png",
    maxDimension: 1000,
  });

  expect(result.scaleFactor).toBe(1.0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "scales screenshot"`
Expected: FAIL

**Step 3: Update ScreenshotOptions and ScreenshotResult interfaces**

In `src/adapters/ui-automator.ts`:

```typescript
export interface ScreenshotOptions {
  localPath?: string;
  inline?: boolean;
  maxDimension?: number;
  raw?: boolean;
}

export interface ScreenshotResult {
  mode: "file" | "inline";
  path?: string;
  base64?: string;
  sizeBytes?: number;
  device?: { width: number; height: number };
  image?: { width: number; height: number };
  scaleFactor?: number;
  warning?: string;
}
```

**Step 4: Implement screenshot scaling**

Import sharp at top of `src/adapters/ui-automator.ts`:

```typescript
import sharp from "sharp";
import { calculateScaleFactor } from "../services/scaling.js";
```

Replace the `screenshot` method:

```typescript
async screenshot(deviceId: string, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
  const remotePath = "/sdcard/replicant-screenshot.png";
  const maxDimension = options.maxDimension ?? 1000;

  // Capture screenshot on device
  const captureResult = await this.adb.shell(deviceId, `screencap -p ${remotePath}`);
  if (captureResult.exitCode !== 0) {
    throw new ReplicantError(
      ErrorCode.SCREENSHOT_FAILED,
      "Failed to capture screenshot",
      captureResult.stderr || "Ensure device screen is on and unlocked"
    );
  }

  try {
    if (options.inline) {
      // Inline mode: return base64 (no scaling support for inline mode)
      const base64Result = await this.adb.shell(deviceId, `base64 ${remotePath}`);
      const sizeResult = await this.adb.shell(deviceId, `stat -c%s ${remotePath}`);
      return {
        mode: "inline",
        base64: base64Result.stdout.trim(),
        sizeBytes: parseInt(sizeResult.stdout.trim(), 10),
      };
    } else {
      // File mode: pull to local, then optionally scale
      const localPath = options.localPath || getDefaultScreenshotPath();
      await this.adb.pull(deviceId, remotePath, localPath);

      // Get image dimensions
      const metadata = await sharp(localPath).metadata();
      const deviceWidth = metadata.width!;
      const deviceHeight = metadata.height!;

      // Handle raw mode
      if (options.raw) {
        this.scalingState = {
          scaleFactor: 1.0,
          deviceWidth,
          deviceHeight,
          imageWidth: deviceWidth,
          imageHeight: deviceHeight,
        };
        return {
          mode: "file",
          path: localPath,
          device: { width: deviceWidth, height: deviceHeight },
          image: { width: deviceWidth, height: deviceHeight },
          scaleFactor: 1.0,
          warning: "Raw mode: no scaling applied. May exceed API limits with multiple images.",
        };
      }

      // Calculate scale factor
      const scaleFactor = calculateScaleFactor(deviceWidth, deviceHeight, maxDimension);

      if (scaleFactor === 1.0) {
        // No scaling needed
        this.scalingState = {
          scaleFactor: 1.0,
          deviceWidth,
          deviceHeight,
          imageWidth: deviceWidth,
          imageHeight: deviceHeight,
        };
        return {
          mode: "file",
          path: localPath,
          device: { width: deviceWidth, height: deviceHeight },
          image: { width: deviceWidth, height: deviceHeight },
          scaleFactor: 1.0,
        };
      }

      // Scale the image
      const imageWidth = Math.round(deviceWidth / scaleFactor);
      const imageHeight = Math.round(deviceHeight / scaleFactor);

      await sharp(localPath)
        .resize(imageWidth, imageHeight)
        .toFile(localPath + ".tmp");

      // Replace original with scaled version
      const fs = await import("fs/promises");
      await fs.rename(localPath + ".tmp", localPath);

      // Update scaling state
      this.scalingState = {
        scaleFactor,
        deviceWidth,
        deviceHeight,
        imageWidth,
        imageHeight,
      };

      return {
        mode: "file",
        path: localPath,
        device: { width: deviceWidth, height: deviceHeight },
        image: { width: imageWidth, height: imageHeight },
        scaleFactor,
      };
    }
  } finally {
    // Always clean up remote file
    await this.adb.shell(deviceId, `rm -f ${remotePath}`);
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/adapters/ui-automator.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/adapters/ui-automator.ts tests/adapters/ui-automator.test.ts
git commit -m "feat(scaling): implement screenshot scaling with sharp"
```

---

## Task 6: Convert Bounds in dump() and find()

**Files:**
- Modify: `src/adapters/ui-automator.ts`
- Modify: `tests/adapters/ui-automator.test.ts`

**Step 1: Write failing test for bounds conversion in dump**

Add to `tests/adapters/ui-automator.test.ts`:

```typescript
describe("dump with scaling", () => {
  it("converts bounds to image space when scaling state exists", async () => {
    // First take a screenshot to set scaling state
    vi.mocked(sharp).mockImplementation(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
      resize: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockResolvedValue(undefined),
    } as any));

    mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    mockAdb.pull.mockResolvedValue(undefined);

    await adapter.screenshot("emulator-5554", { maxDimension: 1000 });

    // Now dump should return converted bounds
    mockAdb.shell
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
      .mockResolvedValueOnce({
        stdout: `<?xml version="1.0"?>
<hierarchy>
  <node text="Button" bounds="[240,480][480,720]" class="android.widget.Button" clickable="true" />
</hierarchy>`,
        stderr: "",
        exitCode: 0,
      }) // cat dump
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

    const tree = await adapter.dump("emulator-5554");

    // With scaleFactor 2.4: [240,480][480,720] -> [100,200][200,300]
    expect(tree[0].bounds).toEqual({ left: 100, top: 200, right: 200, bottom: 300 });
    expect(tree[0].centerX).toBe(150);
    expect(tree[0].centerY).toBe(250);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "converts bounds to image space"`
Expected: FAIL (bounds not converted)

**Step 3: Implement bounds conversion in dump**

Import the conversion helpers at top of `src/adapters/ui-automator.ts`:

```typescript
import { calculateScaleFactor, toImageSpace, boundsToImageSpace } from "../services/scaling.js";
```

Add a helper method to transform the tree:

```typescript
private transformTreeToImageSpace(nodes: AccessibilityNode[]): AccessibilityNode[] {
  if (!this.scalingState || this.scalingState.scaleFactor === 1.0) {
    return nodes;
  }
  const sf = this.scalingState.scaleFactor;
  return nodes.map(node => {
    const newBounds = boundsToImageSpace(node.bounds, sf);
    const center = toImageSpace(node.centerX, node.centerY, sf);
    return {
      ...node,
      bounds: newBounds,
      centerX: center.x,
      centerY: center.y,
      children: node.children ? this.transformTreeToImageSpace(node.children) : [],
    };
  });
}
```

Update `dump()` method to use it:

```typescript
async dump(deviceId: string): Promise<AccessibilityNode[]> {
  // Dump UI hierarchy to device
  await this.adb.shell(deviceId, "uiautomator dump /sdcard/ui-dump.xml");

  // Pull the dump
  const result = await this.adb.shell(deviceId, "cat /sdcard/ui-dump.xml");

  // Clean up
  await this.adb.shell(deviceId, "rm /sdcard/ui-dump.xml");

  const tree = parseUiDump(result.stdout);
  return this.transformTreeToImageSpace(tree);
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/adapters/ui-automator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/ui-automator.ts tests/adapters/ui-automator.test.ts
git commit -m "feat(scaling): convert bounds to image space in dump()"
```

---

## Task 7: Convert Tap Coordinates

**Files:**
- Modify: `src/adapters/ui-automator.ts`
- Modify: `tests/adapters/ui-automator.test.ts`

**Step 1: Write failing test for tap coordinate conversion**

Add to `tests/adapters/ui-automator.test.ts`:

```typescript
describe("tap with scaling", () => {
  it("converts image coordinates to device coordinates", async () => {
    // Set up scaling state via screenshot
    vi.mocked(sharp).mockImplementation(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
      resize: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockResolvedValue(undefined),
    } as any));

    mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    mockAdb.pull.mockResolvedValue(undefined);

    await adapter.screenshot("emulator-5554", { maxDimension: 1000 });

    // Clear mock to check tap call
    mockAdb.shell.mockClear();
    mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    // Tap at image coordinates (200, 500)
    await adapter.tap("emulator-5554", 200, 500);

    // Should convert to device coordinates (480, 1200) with scaleFactor 2.4
    expect(mockAdb.shell).toHaveBeenCalledWith("emulator-5554", "input tap 480 1200");
  });

  it("does not convert when no scaling state", async () => {
    mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await adapter.tap("emulator-5554", 200, 500);

    expect(mockAdb.shell).toHaveBeenCalledWith("emulator-5554", "input tap 200 500");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/ui-automator.test.ts -t "converts image coordinates"`
Expected: FAIL

**Step 3: Implement tap coordinate conversion**

Import `toDeviceSpace` if not already imported, then update `tap()`:

```typescript
async tap(deviceId: string, x: number, y: number): Promise<void> {
  // Convert from image space to device space if scaling is active
  let tapX = x;
  let tapY = y;
  if (this.scalingState && this.scalingState.scaleFactor !== 1.0) {
    const converted = toDeviceSpace(x, y, this.scalingState.scaleFactor);
    tapX = converted.x;
    tapY = converted.y;
  }
  await this.adb.shell(deviceId, `input tap ${tapX} ${tapY}`);
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/adapters/ui-automator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/ui-automator.ts tests/adapters/ui-automator.test.ts
git commit -m "feat(scaling): convert tap coordinates to device space"
```

---

## Task 8: Update Tool Schema and Handler

**Files:**
- Modify: `src/tools/ui.ts`

**Step 1: Add new parameters to schema**

In `src/tools/ui.ts`, update `uiInputSchema`:

```typescript
export const uiInputSchema = z.object({
  operation: z.enum(["dump", "find", "tap", "input", "screenshot", "accessibility-check", "visual-snapshot"]),
  // ... existing fields ...
  maxDimension: z.number().optional(),
  raw: z.boolean().optional(),
});
```

**Step 2: Update tool definition properties**

In `uiToolDefinition.inputSchema.properties`, add:

```typescript
maxDimension: {
  type: "number",
  description: "Max image dimension in pixels (default: 1000). Higher = better quality, more tokens.",
},
raw: {
  type: "boolean",
  description: "Skip scaling, return full device resolution. Warning: may exceed API limits.",
},
```

**Step 3: Update screenshot handler**

In the `case "screenshot":` block, pass new options:

```typescript
case "screenshot": {
  const result = await context.ui.screenshot(deviceId, {
    localPath: input.localPath,
    inline: input.inline,
    maxDimension: input.maxDimension ?? config.maxImageDimension,
    raw: input.raw,
  });
  return { ...result, deviceId };
}
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/ui.ts
git commit -m "feat(scaling): add maxDimension and raw params to ui tool"
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `docs/rtfm/ui.md`

**Step 1: Add Screenshot Scaling section**

Add after existing content in `docs/rtfm/ui.md`:

```markdown
## Screenshot Scaling

Screenshots are automatically scaled to fit within 1000px (longest side) by default.
This prevents API context limits and reduces token usage.

**All coordinates are in image space.** Tap coordinates are automatically converted
to device coordinates. You don't need to do any math.

### Scaling Modes

| Mode | Parameter | Behavior |
|------|-----------|----------|
| Default | (none) | Scale to 1000px max |
| Custom | `maxDimension: 1500` | Scale to specified size |
| Raw | `raw: true` | No scaling (⚠️ may exceed API limits) |

### When to Use Raw Mode

- Non-Anthropic models with different limits
- External context management (compaction, agent respawning)
- Debugging coordinate issues

### Response Format

Screenshot responses now include scaling metadata:

```json
{
  "mode": "file",
  "path": ".replicant/screenshots/screenshot-1234.png",
  "device": { "width": 1080, "height": 2400 },
  "image": { "width": 450, "height": 1000 },
  "scaleFactor": 2.4
}
```

## Context Management

**Prefer accessibility tree (`dump`, `find`) because:**
- No context cost (text, not images)
- Coordinates are precise
- Faster execution

**Use screenshots when:**
- Accessibility tree is empty/unhelpful
- You need to see visual layout
- Icons have no text labels

**Ask yourself:** Do I need to SEE the screen, or just INTERACT with it?
```

**Step 2: Commit**

```bash
git add docs/rtfm/ui.md
git commit -m "docs: add screenshot scaling documentation"
```

---

## Task 10: Update MCP Server Instructions

**Files:**
- Modify: `src/server.ts`

**Step 1: Find and update UI instruction line**

In `src/server.ts`, find the instruction line mentioning UI and update to note scaling:

```typescript
- UI automation → ui (accessibility-first, screenshots auto-scaled to 1000px)
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server.ts
git commit -m "docs: note screenshot auto-scaling in MCP instructions"
```

---

## Task 11: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual verification (optional)**

If emulator available:
1. Start emulator
2. Run: `npx replicant-mcp`
3. Test screenshot, verify dimensions ≤1000px in response
4. Test dump + tap elementIndex flow
5. Test raw mode

---

## File Change Summary

| File | Change |
|------|--------|
| `src/services/scaling.ts` | New file with scale factor and coordinate conversion |
| `tests/services/scaling.test.ts` | New test file for scaling functions |
| `src/types/config.ts` | Add `maxImageDimension` to UiConfig |
| `src/adapters/ui-automator.ts` | Scaling state, screenshot resize, coordinate conversion |
| `tests/adapters/ui-automator.test.ts` | Tests for scaling behavior |
| `src/tools/ui.ts` | New params, config default, pass through to adapter |
| `docs/rtfm/ui.md` | Scaling and context management docs |
| `src/server.ts` | Update instructions |
