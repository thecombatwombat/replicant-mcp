# Screenshot Scaling - Implementation Plan

**Branch:** `feature/screenshot-scaling`
**Design doc:** `docs/plans/2026-01-22-screenshot-scaling-design.md`

## Overview

Implement automatic screenshot scaling to prevent API context limits and reduce token usage. All coordinates transparently converted between image space and device space.

## Implementation Tasks

### Task 1: Add scaling configuration

**File:** `src/types/config.ts`

Add to `UiConfig` interface:
```typescript
/** Maximum dimension (width or height) for screenshots. Default: 1000 */
maxImageDimension: number;
```

Update default config in `src/config.ts` (or wherever defaults are set):
```typescript
maxImageDimension: 1000
```

---

### Task 2: Add scaling state management

**File:** `src/adapters/ui-automator.ts`

Add interface and state to track scaling:
```typescript
interface ScalingState {
  scaleFactor: number;
  deviceWidth: number;
  deviceHeight: number;
  imageWidth: number;
  imageHeight: number;
}

// In UiAutomatorAdapter class
private scalingState: ScalingState | null = null;
```

Add helper methods:
```typescript
private calculateScaleFactor(
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

private toImageSpace(deviceX: number, deviceY: number): { x: number; y: number } {
  if (!this.scalingState || this.scalingState.scaleFactor === 1.0) {
    return { x: deviceX, y: deviceY };
  }
  return {
    x: Math.round(deviceX / this.scalingState.scaleFactor),
    y: Math.round(deviceY / this.scalingState.scaleFactor),
  };
}

private toDeviceSpace(imageX: number, imageY: number): { x: number; y: number } {
  if (!this.scalingState || this.scalingState.scaleFactor === 1.0) {
    return { x: imageX, y: imageY };
  }
  return {
    x: Math.round(imageX * this.scalingState.scaleFactor),
    y: Math.round(imageY * this.scalingState.scaleFactor),
  };
}

private boundsToImageSpace(bounds: Bounds): Bounds {
  if (!this.scalingState || this.scalingState.scaleFactor === 1.0) {
    return bounds;
  }
  const sf = this.scalingState.scaleFactor;
  return {
    left: Math.round(bounds.left / sf),
    top: Math.round(bounds.top / sf),
    right: Math.round(bounds.right / sf),
    bottom: Math.round(bounds.bottom / sf),
  };
}
```

---

### Task 3: Implement image resizing in screenshot()

**File:** `src/adapters/ui-automator.ts`

**Dependencies needed:** `sharp` (add to package.json)

```bash
npm install sharp
npm install -D @types/sharp
```

Modify `screenshot()` method:

1. After pulling image from device, get its dimensions
2. Calculate scale factor based on config `maxImageDimension`
3. If scaling needed, resize with sharp
4. Update `scalingState`
5. Return enhanced response with scaling metadata

**New parameters for screenshot:**
```typescript
interface ScreenshotOptions {
  localPath?: string;
  inline?: boolean;
  maxDimension?: number;  // Override default
  raw?: boolean;          // Skip scaling entirely
}
```

**New response format:**
```typescript
interface ScreenshotResult {
  mode: "file" | "inline";
  path?: string;
  base64?: string;
  sizeBytes?: number;
  device: { width: number; height: number };
  image: { width: number; height: number };
  scaleFactor: number;
  warning?: string;  // Present when raw=true
}
```

---

### Task 4: Convert bounds in dump()

**File:** `src/adapters/ui-automator.ts`

In `dump()` method, after getting accessibility tree:
- Traverse all nodes
- Convert `bounds`, `centerX`, `centerY` to image space using `boundsToImageSpace()` and `toImageSpace()`

Create helper to transform tree:
```typescript
private transformTreeToImageSpace(nodes: AccessibilityNode[]): AccessibilityNode[] {
  return nodes.map(node => ({
    ...node,
    bounds: this.boundsToImageSpace(node.bounds),
    centerX: this.toImageSpace(node.centerX, 0).x,
    centerY: this.toImageSpace(0, node.centerY).y,
    children: node.children ? this.transformTreeToImageSpace(node.children) : [],
  }));
}
```

---

### Task 5: Convert bounds in find()

**File:** `src/adapters/ui-automator.ts`

In `find()` method:
- Convert element bounds to image space before returning
- Applies to both accessibility-based and OCR-based results

---

### Task 6: Convert coordinates in tap()

**File:** `src/adapters/ui-automator.ts`

In `tap()` method, when using x/y coordinates:
```typescript
const { x: deviceX, y: deviceY } = this.toDeviceSpace(x, y);
await this.adb.shell(deviceId, `input tap ${deviceX} ${deviceY}`);
```

Note: `elementIndex` taps use stored bounds which are already in image space, so conversion still applies.

---

### Task 7: Update tool input schema

**File:** `src/tools/ui.ts`

Add new parameters to schema:
```typescript
maxDimension: z.number().optional(),
raw: z.boolean().optional(),
```

Update tool definition properties:
```typescript
maxDimension: {
  type: "number",
  description: "Max image dimension in pixels (default: 1000). Higher = better quality, more tokens."
},
raw: {
  type: "boolean",
  description: "Skip scaling, return full device resolution. Warning: may exceed API limits."
},
```

---

### Task 8: Update tool handler

**File:** `src/tools/ui.ts`

Pass new options through to adapter:
```typescript
case "screenshot": {
  const result = await context.ui.screenshot(deviceId, {
    localPath: input.localPath,
    inline: input.inline,
    maxDimension: input.maxDimension,
    raw: input.raw,
  });
  return { ...result, deviceId };
}
```

---

### Task 9: Update documentation

**File:** `docs/rtfm/ui.md`

Add new section after "Fallback chain":

```markdown
## Screenshot Scaling

Screenshots are automatically scaled to fit within 1000px (longest side) by default.
This prevents API context limits and reduces token usage.

**All coordinates are in image space.** Tap coordinates are automatically converted
to device coordinates. You don't need to do any math.

**Scaling modes:**

| Mode | Parameter | Behavior |
|------|-----------|----------|
| Default | (none) | Scale to 1000px max |
| Custom | `maxDimension: 1500` | Scale to specified size |
| Raw | `raw: true` | No scaling (⚠️ may exceed API limits) |

**When to use raw mode:**
- Non-Anthropic models with different limits
- External context management (compaction, agent respawning)
- Debugging coordinate issues

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

---

### Task 10: Update MCP server instructions

**File:** `src/server.ts`

Update the UI line in instructions:
```typescript
- UI automation → ui (accessibility-first, screenshots auto-scaled)
```

---

### Task 11: Write tests

**File:** `src/__tests__/scaling.test.ts` (new file)

Test cases:
1. `calculateScaleFactor` returns correct values for various device sizes
2. `calculateScaleFactor` returns 1.0 for small devices
3. `toImageSpace` and `toDeviceSpace` are inverses (round-trip)
4. `boundsToImageSpace` converts all four corners correctly
5. Screenshot with default scaling produces correct dimensions
6. Screenshot with `raw: true` skips scaling
7. Screenshot with custom `maxDimension` uses that value
8. Tap coordinates are converted correctly
9. Dump bounds are in image space

---

## File Change Summary

| File | Change |
|------|--------|
| `package.json` | Add `sharp` dependency |
| `src/types/config.ts` | Add `maxImageDimension` to UiConfig |
| `src/adapters/ui-automator.ts` | Core scaling logic |
| `src/tools/ui.ts` | New params, pass through to adapter |
| `docs/rtfm/ui.md` | Scaling and context management docs |
| `src/server.ts` | Update instructions |
| `src/__tests__/scaling.test.ts` | New test file |

## Verification

After implementation:
1. Run `npm test` - all tests pass
2. Manual test on emulator:
   - Take screenshot, verify dimensions ≤1000px
   - `dump` + `tap elementIndex` - verify tap lands correctly
   - `screenshot` + visual `tap x y` - verify conversion works
   - `raw: true` - verify full resolution returned with warning
3. Extended session test - take 10+ screenshots, verify no API errors

## Notes for Implementation

- The `sharp` library handles image resizing efficiently
- Scaling state is per-adapter-instance; if device changes, recalculate on next screenshot
- Round coordinates to integers after conversion to avoid sub-pixel issues
- The design doc has full rationale for decisions made here
