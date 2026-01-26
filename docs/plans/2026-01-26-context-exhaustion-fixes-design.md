# Context Exhaustion Fixes Design

**Date:** 2026-01-26
**Status:** Approved
**Issues:** replicant-mcp-b0v, replicant-mcp-3bk, replicant-mcp-0h2

## Problem

Three MCP tool responses are exhausting context windows:

| Tool | Current Size | Impact |
|------|-------------|--------|
| `ui find` grid image | 151K chars (PNG) | Single call > 4 screenshots |
| `adb-device properties` | 28K chars | Called 2x = 56K |
| `adb-app list` | 11K chars (250 pkgs) | No filtering |

Total: ~190K chars in a short session, causing Claude to hit context limits.

## Solution Philosophy

**Don't dump data, give control.** Apply same patterns used elsewhere:
1. JPEG compression for images (not PNG)
2. Progressive disclosure via cache IDs
3. Pagination/filtering for lists

## Fix 1: Grid Image Compression

**File:** `src/services/grid.ts`
**Issue:** replicant-mcp-b0v
**Impact:** 151K → ~35K (77% reduction)

### Current Code (line 135-138)
```typescript
const buffer = await image
  .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
  .png()
  .toBuffer();
```

### Fixed Code
```typescript
const metadata = await image.metadata();
const maxDim = 1000;
const scale = Math.min(1, maxDim / Math.max(metadata.width!, metadata.height!));
const newWidth = Math.round(metadata.width! * scale);
const newHeight = Math.round(metadata.height! * scale);

const buffer = await image
  .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
  .resize(newWidth, newHeight)
  .jpeg({ quality: 70 })
  .toBuffer();
```

### API Changes
None - same response format, just smaller.

---

## Fix 2: Device Properties Progressive Disclosure

**File:** `src/tools/adb-device.ts`
**Issue:** replicant-mcp-3bk
**Impact:** 28K → ~500 chars (98% reduction)

### Current Response
```json
{
  "deviceId": "emulator-5554",
  "properties": {
    "model": "...",
    "manufacturer": "...",
    // ... 400+ properties, 28K chars
  }
}
```

### Fixed Response
```json
{
  "deviceId": "emulator-5554",
  "summary": {
    "model": "sdk_gphone64_arm64",
    "manufacturer": "Google",
    "sdkVersion": "36",
    "androidVersion": "16",
    "device": "emu64a",
    "product": "sdk_gphone64_arm64",
    "hardware": "ranchu",
    "abiList": "arm64-v8a"
  },
  "propertyCount": 423,
  "cacheId": "device-props-abc123"
}
```

### Fetching Full Properties
```
cache get device-props-abc123
```

### Implementation
1. Extract key properties into summary
2. Cache full properties with TTL
3. Return cache ID for detail fetching

---

## Fix 3: App List Pagination & Filtering

**File:** `src/tools/adb-app.ts`
**Issue:** replicant-mcp-0h2
**Impact:** 11K → ~2K (82% reduction for default case)

### Current API
```json
{ "operation": "list" }
```

### New API
```json
{
  "operation": "list",
  "limit": 20,           // default: 20, max: 100
  "filter": "google",    // optional: package name contains
  "offset": 0            // optional: for pagination
}
```

### Current Response
```json
{
  "packages": ["com.android.a", "com.android.b", ...],  // 250 items
  "count": 250
}
```

### Fixed Response
```json
{
  "packages": ["com.google.android.apps.messaging", ...],  // 20 items
  "count": 20,
  "totalCount": 45,      // total matching filter
  "hasMore": true,
  "cacheId": "app-list-abc123"  // full list cached
}
```

### Implementation
1. Add `limit`, `filter`, `offset` parameters to schema
2. Filter packages by pattern match
3. Paginate results
4. Cache full list for subsequent requests

---

## Implementation Order

1. **Grid image** - Simplest, biggest impact, no API changes
2. **Device properties** - Medium complexity, high impact
3. **App list** - Most complex (new params), lower impact

## Testing

Each fix needs:
- Unit test for size reduction
- Integration test for functionality preservation
- Manual test in Claude Desktop

## Rollout

All fixes are backward compatible:
- Grid image: transparent (same field, smaller value)
- Device properties: new `cacheId` field (additive)
- App list: new optional params (defaults preserve behavior... with limit)

Note: App list default `limit: 20` is a behavior change, but intentional - returning 250 packages was never useful.
