# Visual Fallback for UI Automation

**Status:** Design complete
**Epic:** Visual Fallback
**Created:** 2025-01-21

## Overview

When accessibility-based element finding fails (missing labels, poorly structured apps), the MCP server provides a screenshot with screen metadata so the consuming LLM can fall back to coordinate-based interaction.

## Goals

**Phase 1 (this design):**
- Provide screenshot + metadata when accessibility fails
- Allow explicit visual mode for known problematic apps
- Keep server lightweight - no OCR/CV dependencies yet
- Set up config infrastructure for future phases

**Non-goals for Phase 1:**
- Server-side text recognition (Phase 2)
- Server-side image/template matching (Phase 3)
- Automatic coordinate snapping or validation

## User Experience

**Automatic fallback:**
1. LLM calls `ui { operation: "find", selector: { text: "Login" } }`
2. If found: returns elements as usual
3. If not found: returns empty results + screenshot + metadata
4. LLM looks at screenshot, estimates coordinates, calls `ui { operation: "tap", x: 540, y: 800 }`

**Explicit visual mode:**
1. LLM calls `ui { operation: "visual-snapshot" }`
2. Server returns screenshot + metadata immediately
3. LLM estimates coordinates and taps

## Visual Snapshot Response

```typescript
interface VisualSnapshot {
  screenshotPath: string;        // Local path to PNG file
  screenshotBase64?: string;     // Optional: base64-encoded image data

  screen: {
    width: number;               // e.g., 1080
    height: number;              // e.g., 2400
    density: number;             // e.g., 2.75 (pixels per dp)
  };

  app: {
    packageName: string;         // e.g., "com.example.app"
    activityName: string;        // e.g., ".MainActivity"
  };

  hint?: string;                 // e.g., "No elements matched selector..."
}
```

## Configuration

**Environment variable:**
```bash
REPLICANT_CONFIG=/path/to/replicant.yaml
```

**Config file format:**
```yaml
ui:
  # Always skip accessibility and use visual mode for these packages
  visualModePackages:
    - com.problematic.app
    - com.legacy.app.without.accessibility

  # Auto-include screenshot when find returns no results (default: true)
  autoFallbackScreenshot: true

  # Include base64-encoded screenshot in response (default: false)
  includeBase64: false
```

**Loading behavior:**
1. On server startup, check for `REPLICANT_CONFIG` env var
2. If set and file exists, parse YAML and merge with defaults
3. If set but file missing, log warning and use defaults
4. If not set, use defaults silently

## Tool Changes

**`find` operation (modified):**

When `count === 0` AND `autoFallbackScreenshot` enabled:
```json
{
  "elements": [],
  "count": 0,
  "deviceId": "emulator-5554",
  "visualFallback": {
    "screenshotPath": "/tmp/replicant-screenshot-1705812345.png",
    "screen": { "width": 1080, "height": 2400, "density": 2.75 },
    "app": { "packageName": "com.example", "activityName": ".MainActivity" },
    "hint": "No elements matched selector. Use screenshot to identify tap coordinates."
  }
}
```

**`visual-snapshot` operation (new):**
```json
{
  "screenshotPath": "/tmp/replicant-screenshot-1705812345.png",
  "screen": { "width": 1080, "height": 2400, "density": 2.75 },
  "app": { "packageName": "com.example", "activityName": ".MainActivity" },
  "deviceId": "emulator-5554"
}
```

## Implementation

**Files to modify:**

1. `src/types/index.ts` - Add config and visual snapshot types
2. `src/config.ts` (new) - Config loading with YAML parsing
3. `src/tools/ui.ts` - Add `visual-snapshot`, modify `find` for fallback
4. `src/services/ui.ts` - Add `getScreenMetadata()`, `getCurrentApp()`
5. `src/server.ts` - Load config on startup

**New dependency:** `js-yaml`

**Tests to add:**
- Config loading (valid file, missing file, malformed file)
- Visual fallback on empty find results
- `visual-snapshot` operation
- `visualModePackages` override behavior

## Phased Roadmap

**Phase 1: LLM-only visual fallback (this design)**
- Screenshot + metadata on accessibility failure
- `visual-snapshot` operation
- YAML config via `REPLICANT_CONFIG`

**Phase 2: OCR support**
- Tesseract integration
- `visual-find-text` operation
- Config: `ui.ocrEnabled`

**Phase 3: Template matching**
- OpenCV or similar
- `visual-find-image` operation
- Config: `ui.templateMatchingEnabled`

Each phase is additive - existing behavior unchanged. Config defaults keep new features opt-in.
