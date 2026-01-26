# Inline Screenshot Scaling Design

**Issue:** replicant-mcp-wl1
**Date:** 2026-01-26
**Status:** Approved

## Problem

Inline screenshots bypass all scaling, returning 1.9MB base64 images that exceed Claude Desktop limits. The inline code path in `ui-automator.ts` just base64-encodes the raw PNG without any processing.

## Solution

Make inline mode work like file mode internally: pull to temp file → scale with sharp → convert to JPEG q70 → return base64. Both modes share the same scaling/compression pipeline and maintain scaling state for coordinate conversion.

### Current Flow (Broken)

```
Device → base64 command on device → raw 1.9MB PNG base64 → return
```

### New Flow

```
Device → pull to temp file → sharp resize → JPEG q70 → base64 encode → return
         ↓
    update scalingState for coordinate conversion
```

## Implementation

### Changes to `src/adapters/ui-automator.ts`

Replace the inline branch (lines 229-239) with:

```typescript
if (options.inline) {
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
    await fs.promises.unlink(tempPath).catch(() => {});
  }
}
```

### Type Changes

Update `ScreenshotResult` type:
- Add `mimeType?: string` field
- Add optional `device`, `image`, `scaleFactor` fields to the inline variant

## Testing

### P1 Tests (Required for this fix)

1. **Size reduction verification** — Verify JPEG q70 brings size under 200KB (was 1.9MB)

2. **Dimension reporting accuracy** — Verify `device`, `image`, `scaleFactor` fields are correct

3. **Scaling state regression guard** — Test named `*_REGRESSION_wl1` that fails if `scalingState` is null after inline screenshot

4. **Consistency contract test** — Shared assertions run against both inline and file mode, catches drift

5. **No partial state on error** — If sharp throws, `scalingState` must remain unchanged

6. **Temp file cleanup on success** — No temp files left after successful screenshot

7. **Temp file cleanup on error** — No temp files left even when sharp throws

### Follow-up Test Tickets

See linked issues for additional test coverage:
- Property-based invariant tests
- Boundary condition tests (small screen, square, ultra-wide, extreme maxDimension)
- Error handling tests (corrupt PNG, disk full)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `adb pull` fails | Throw `ReplicantError(SCREENSHOT_FAILED)`, no temp file to clean |
| `sharp.metadata()` fails | Throw error, clean up temp file, don't update `scalingState` |
| `sharp.resize().jpeg()` fails | Throw error, clean up temp file, don't update `scalingState` |
| Temp file deletion fails | Swallow error (best-effort cleanup), return result normally |

**Key invariant:** `scalingState` is only updated after successful processing. If anything fails mid-pipeline, the previous scaling state remains intact.

## Follow-up Work

- Convert file mode screenshots to JPEG as well (separate issue)
