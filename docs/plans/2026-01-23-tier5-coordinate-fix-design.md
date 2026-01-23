# Design: Fix Tier 5 Grid Coordinate Space

**Date:** 2026-01-23
**Issue:** replicant-mcp-2gy
**Status:** Ready for implementation

## Problem

When screenshot scaling is active, Tier 5 grid refinement returns device-space coordinates, but `tap()` expects image-space coordinates and scales them again — causing taps to land off-screen.

**Current flow (broken):**
```
Screenshot taken → scalingState.scaleFactor = 2.4
Grid overlay drawn on 1000px image → user sees cell 12
User calls find with gridCell=12 → uses getScreenMetadata() → 1080x2400
Returns center (540, 1200) in device space
tap() scales: 540 × 2.4 = 1296 → off-screen!
```

**Fixed flow:**
```
Screenshot taken → scalingState set with imageWidth=450, imageHeight=1000
Grid overlay drawn on 450x1000 image → user sees cell 12
User calls find with gridCell=12 → uses scalingState dimensions → 450x1000
Returns center (225, 500) in image space
tap() scales: 225 × 2.4 = 540 → correct!
```

## Solution

### Change 1: Fix Tier 5 refinement coordinates

**File:** `src/adapters/ui-automator.ts`

In `findWithFallbacks()`, the Tier 5 refinement section (lines 445-462) should use `scalingState` dimensions when scaling is active:

```typescript
// Handle Tier 5 grid refinement FIRST (when gridCell and gridPosition are provided)
if (options.gridCell !== undefined && options.gridPosition !== undefined) {
  // Use image dimensions if scaling is active, otherwise device dimensions
  let width: number, height: number;
  if (this.scalingState && this.scalingState.scaleFactor !== 1.0) {
    width = this.scalingState.imageWidth;
    height = this.scalingState.imageHeight;
  } else {
    const screen = await this.getScreenMetadata(deviceId);
    width = screen.width;
    height = screen.height;
  }

  const cellBounds = calculateGridCellBounds(options.gridCell, width, height);
  const coords = calculatePositionCoordinates(options.gridPosition, cellBounds);

  return {
    elements: [
      {
        index: 0,
        bounds: `[${cellBounds.x0},${cellBounds.y0}][${cellBounds.x1},${cellBounds.y1}]`,
        center: coords,
      },
    ],
    source: "grid",
    tier: 5,
    confidence: "low",
  };
}
```

### Change 2: Remove dead code

**File:** `src/adapters/ui-automator.ts`

Line 558 has an unused variable:
```typescript
const screen = await this.getScreenMetadata(deviceId);  // DELETE - unused
```

## Testing

### Unit tests (tests/adapters/ui-automator.test.ts)

1. **Tier 5 refinement with active scaling**
   - Set up mock with scalingState (factor 2.4, image 450x1000)
   - Call findWithFallbacks with gridCell=12, gridPosition=3
   - Assert returned coordinates are in image space (center ~225, ~500)

2. **Tier 5 refinement without scaling**
   - No scalingState set
   - Call findWithFallbacks with gridCell=12, gridPosition=3
   - Assert returned coordinates match device dimensions

3. **End-to-end tap accuracy**
   - Take screenshot (sets scalingState)
   - Get Tier 5 fallback (grid)
   - Call refinement with gridCell/gridPosition
   - Call tap with returned coordinates
   - Assert `input tap` command has correct device-space values

## Out of Scope

These are tracked as separate tasks:

1. **Add deviceSpace parameter to ui tap** — Allow users to pass raw device coordinates directly without scaling conversion
2. **Grid dimension staleness** — Handle edge case where screenshot changes between grid display and refinement

## Rollout

- Patch release (bug fix, no API changes)
- No migration needed
