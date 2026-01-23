# Screenshot Scaling Design

**Date:** 2026-01-22
**Status:** Proposed
**Author:** Claude + Archit

## Problem Statement

During extended UI automation sessions, replicant-mcp accumulates screenshots in the model's context. This leads to two failures:

1. **API dimension limits**: Claude's API limits images to 2000px per side when many images (22+) are in context. Modern Android devices (1008x2244, 1440x3120) exceed this.

2. **Context exhaustion**: Large, full-resolution screenshots consume excessive tokens, leaving insufficient room for reasoning.

### Evidence

A session automating the "Focus Strength" app accumulated 25 screenshots (~6.7MB total), resulting in:
```
API Error 400: "At least one of the image dimensions exceed max allowed
size for many-image requests: 2000 pixels"
```

The device resolution was 1008x2244 (height exceeded 2000px limit).

## Design Goals

1. **Sensible defaults** that work out of the box for Anthropic models
2. **Override capability** for custom needs
3. **Escape hatch** for agents that manage context externally
4. **Invisible coordinate conversion** so agents don't do math

## Non-Goals

- Saving agents from bad decision-making
- Auto-recovering from context exhaustion
- Predicting future API changes

## Solution Overview

### Automatic Image Scaling

All screenshots are scaled to fit within a configurable maximum dimension (default: 1000px). Coordinates throughout the system are transparently converted between image space and device space.

```
Device: 1080x2400 (Android phone)
    ↓ scale to fit 1000px
Image: 450x1000 (what model sees)

Scale factor: 2.4
```

### Coordinate Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Device    │     │    MCP      │     │    Agent    │
│  (1080x2400)│     │  (converts) │     │ (sees 450x1000)
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  screencap        │                   │
       │──────────────────>│   resize          │
       │                   │──────────────────>│ screenshot
       │                   │                   │
       │                   │<──────────────────│ tap x=200 y=500
       │   tap x=480 y=1200│   (×2.4)          │
       │<──────────────────│                   │
       │                   │                   │
       │  dump (bounds)    │   (÷2.4)          │
       │──────────────────>│──────────────────>│ bounds in image space
```

**Key principle:** The agent only ever sees image-space coordinates. It doesn't know about scaling.

## Detailed Design

### Configuration

```typescript
interface UiConfig {
  // ... existing fields ...

  /**
   * Maximum dimension (width or height) for screenshots.
   * Images are scaled to fit within this limit while preserving aspect ratio.
   * Default: 1000
   */
  maxImageDimension: number;
}
```

### Screenshot Operation

```typescript
ui screenshot                        // uses default (1000px)
ui screenshot maxDimension=1500      // custom limit
ui screenshot raw=true               // no scaling (dangerous)
```

**Response with scaling:**
```json
{
  "mode": "file",
  "path": ".replicant/screenshots/screenshot-1234.png",
  "device": { "width": 1080, "height": 2400 },
  "image": { "width": 450, "height": 1000 },
  "scaleFactor": 2.4
}
```

**Response with raw mode:**
```json
{
  "mode": "file",
  "path": ".replicant/screenshots/screenshot-1234.png",
  "device": { "width": 1080, "height": 2400 },
  "image": { "width": 1080, "height": 2400 },
  "scaleFactor": 1.0,
  "warning": "Raw mode: no scaling applied. May exceed API limits with multiple images."
}
```

### Scale Factor Calculation

Calculated on each screenshot based on current device resolution:

```typescript
function calculateScaleFactor(
  deviceWidth: number,
  deviceHeight: number,
  maxDimension: number
): number {
  const longestSide = Math.max(deviceWidth, deviceHeight);
  if (longestSide <= maxDimension) {
    return 1.0; // No scaling needed
  }
  return longestSide / maxDimension;
}
```

This automatically handles:
- Device rotation (portrait ↔ landscape)
- Device switching mid-session
- Small devices that don't need scaling

### Coordinate Conversion

**Stored state:**
```typescript
interface ScalingState {
  scaleFactor: number;
  deviceWidth: number;
  deviceHeight: number;
}
```

Updated on every screenshot operation.

**Dump/Find operations:**
Convert accessibility bounds from device space to image space before returning:

```typescript
function toImageSpace(bounds: Bounds, scaleFactor: number): Bounds {
  return {
    left: Math.round(bounds.left / scaleFactor),
    top: Math.round(bounds.top / scaleFactor),
    right: Math.round(bounds.right / scaleFactor),
    bottom: Math.round(bounds.bottom / scaleFactor),
  };
}
```

**Tap operation:**
Convert coordinates from image space to device space before sending to ADB:

```typescript
function toDeviceSpace(x: number, y: number, scaleFactor: number): [number, number] {
  return [
    Math.round(x * scaleFactor),
    Math.round(y * scaleFactor),
  ];
}
```

### Android Device Coverage

| Device Type | Native Resolution | At 1000px | Scale Factor |
|-------------|-------------------|-----------|--------------|
| Budget phone | 1080x2340 | 462x1000 | 2.34 |
| Standard phone | 1080x2400 | 450x1000 | 2.40 |
| Flagship phone | 1440x3120 | 462x1000 | 3.12 |
| Foldable (cover) | 1080x2092 | 516x1000 | 2.09 |
| Foldable (inner) | 1840x2208 | 833x1000 | 2.21 |
| Small tablet | 1600x2560 | 625x1000 | 2.56 |
| Large tablet | 1848x2960 | 624x1000 | 2.96 |

All result in readable image widths (450-833px) suitable for UI element identification.

### Scaling Modes

| Mode | Parameter | Behavior | Use Case |
|------|-----------|----------|----------|
| Default | (none) | Scale to 1000px | Standard automation |
| Custom | `maxDimension=N` | Scale to N px | Quality/size tuning |
| Raw | `raw=true` | No scaling | External context management |

### Raw Mode

Bypasses all scaling. The agent receives full device resolution and is responsible for context management.

**When to use:**
- Non-Anthropic models with different limits
- Sub-agent architectures with context compaction
- Agent respawning strategies
- Debugging coordinate issues
- Future models with improved capacity

**Warning included in response:**
```
"Raw mode: no scaling applied. May exceed API limits with multiple images."
```

## Implementation Plan

### Phase 1: Core Scaling
1. Add `maxImageDimension` to config (default: 1000)
2. Implement image resizing in `screenshot()` method
3. Store scaling state after each screenshot
4. Update screenshot response format

### Phase 2: Coordinate Conversion
5. Convert bounds in `dump()` and `find()` to image space
6. Convert tap coordinates to device space
7. Handle `elementIndex` taps (use stored bounds, already converted)

### Phase 3: Raw Mode
8. Add `raw` parameter to screenshot operation
9. Skip scaling when `raw=true`
10. Include warning in response

### Phase 4: Documentation
11. Update `rtfm ui` with scaling documentation
12. Add guidance on when to override defaults

## Testing

1. **Unit tests:**
   - Scale factor calculation for various resolutions
   - Coordinate conversion accuracy
   - Bounds conversion for accessibility tree

2. **Integration tests:**
   - Screenshot + tap flow with scaling
   - Device rotation handling
   - Raw mode bypass

3. **Manual validation:**
   - Test on physical phone, emulator, tablet
   - Verify tap accuracy after scaling
   - Confirm extended sessions don't hit API limits

## Alternatives Considered

### A. Explicit coordinate source flag
`tap x=400 y=1000 fromImage=true`

Rejected: Requires agent to remember flag, high chance of errors.

### B. Separate visual-tap operation
`operation: "visual-tap"` vs `operation: "tap"`

Rejected: Agent must choose correctly. Implicit conversion is safer.

### C. No scaling, guidance only
Tell agents to take fewer screenshots.

Rejected: Doesn't address API dimension limits. Behavioral change unreliable.

### D. Resize to 2000px (API limit)
Use maximum allowed size.

Rejected: Wastes context. 1000px is sufficient for UI understanding and leaves room for multiple screenshots.

## Open Questions

None. Ready for implementation.
