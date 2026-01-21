# OCR Fallback for UI Text Search

**Status:** Design complete
**Epic:** Visual Fallback (Phase 2)
**Created:** 2026-01-21

## Problem Statement

Apps like Pinterest don't expose text content in their accessibility tree. When Claude calls `ui { operation: "find", selector: { text: "Chobani" } }`, the accessibility-based search returns nothing even though "Chobani" is clearly visible on screen.

Current behavior forces Claude to fall back to visual recognition of screenshots, which is unreliable. In the observed failure case, Claude looked directly at a screenshot containing a Chobani ad and said "I don't see it" - then proceeded to scroll the ad out of view while searching for it.

**Root causes identified:**
1. Pinterest accessibility tree contains `pin_rep_id` elements with no text content
2. LLM visual recognition is unreliable for finding specific text in busy UIs
3. LLM couldn't detect that scrolling was changing the screen content

## Solution

Add OCR fallback to the `find` operation. When accessibility-based text search returns no results, automatically run OCR on a screenshot and search the extracted text. Return matching elements with bounds that Claude can use for tapping.

**Key principle:** Claude shouldn't need to know OCR exists. The tool "just works."

## Scope

**In scope:**
- Text-based visual search via OCR
- Automatic fallback (no changes to how Claude calls the tool)
- Zero additional setup for users

**Out of scope (follow-up items):**
- Icon/symbol recognition (three dots overflow, share icon, etc.)
- Semantic image understanding ("the makeup ad")

## Technical Approach

### OCR Library: tesseract.js

- Pure JavaScript/WebAssembly port of Tesseract
- Bundled as npm dependency - zero native installation required
- Cross-platform by default
- Trade-off: slightly slower than native Tesseract (~1-2 seconds), but "just works"

### Integration: Automatic Fallback

When `ui { operation: "find", selector: { text: "..." } }` is called:

1. Try accessibility tree search (existing behavior)
2. If results found → return them (no change)
3. If no results → take screenshot → run OCR → search extracted text → return matches

### Text Matching

- **Contains** (not exact match) - "Chobani" matches "Chobani High Protein Drinks"
- **Case-insensitive** - "chobani" matches "CHOBANI"

### Response Format

Same structure as accessibility results:

```json
{
  "elements": [
    {
      "index": 0,
      "text": "Chobani High Protein Drinks & Cups",
      "bounds": "[10,761][535,1200]",
      "center": { "x": 272, "y": 980 }
    }
  ],
  "count": 1
}
```

Optional `debug: true` parameter adds diagnostic fields:

```json
{
  "elements": [...],
  "count": 1,
  "source": "ocr",
  "ocrConfidence": 0.92,
  "fallbackReason": "accessibility tree had no matching text"
}
```

## Implementation

### New Dependency

```json
"tesseract.js": "^5.x"
```

### Files to Modify

1. **`src/services/ocr.ts`** (new)
   - Initialize tesseract.js worker
   - `extractText(imagePath): Promise<OcrResult[]>` - returns text with bounding boxes
   - Lazy initialization (only load OCR engine when first needed)

2. **`src/tools/ui.ts`**
   - Modify `find` operation to call OCR fallback when accessibility returns empty
   - Add `debug` parameter support

3. **`src/types/index.ts`**
   - Add `OcrResult` interface
   - Extend `FindResult` to include optional debug fields

### Internal Types

```typescript
interface OcrResult {
  text: string;
  confidence: number;
  bounds: {
    x0: number; y0: number;
    x1: number; y1: number;
  };
}
```

### Performance Considerations

- tesseract.js worker initialized lazily on first OCR call
- No caching for now (YAGNI - can add later if needed)
- Typical OCR time: 1-2 seconds per screenshot

## Testing

### OCR Service Tests (`src/services/__tests__/ocr.test.ts`)

**Text extraction:**
- Extracts single word from clean image
- Extracts multi-line text preserving structure
- Extracts text from busy/cluttered backgrounds (like Pinterest feed)
- Returns empty array for image with no text
- Returns empty array for blank/solid color image

**Bounding boxes:**
- Bounding boxes are within image dimensions
- Bounding boxes don't overlap incorrectly
- Bounding boxes accurately surround text (test with known coordinates)

**Confidence scores:**
- High confidence for clean, clear text
- Lower confidence for blurry/partial text
- Confidence values are in valid range (0-1)

**Edge cases & error handling:**
- Handles corrupted image file gracefully
- Handles missing image file (returns error, doesn't crash)
- Handles very large images (timeout or graceful failure)
- Handles non-image files passed as input
- Worker initialization failure is handled

**Performance:**
- Lazy initialization: worker not loaded until first call
- Subsequent calls reuse worker (don't reinitialize)

### Find Operation Fallback Tests (`src/tools/__tests__/ui-ocr-fallback.test.ts`)

**Fallback trigger conditions:**
- Does NOT call OCR when accessibility finds matches
- Calls OCR when accessibility returns zero results
- Calls OCR when accessibility returns elements but none match text selector

**Text matching:**
- Exact text matches
- Partial text matches (contains)
- Case-insensitive matching
- Multiple matches returned in order
- No matches returns empty array (not error)

**Response format:**
- Returns same structure as accessibility results
- `bounds` field formatted correctly
- `center` point calculated correctly from bounds
- `debug: false` (default) excludes source/confidence
- `debug: true` includes `source: "ocr"` and `ocrConfidence`

**Error handling:**
- Screenshot failure doesn't crash (returns empty with error hint)
- OCR failure doesn't crash (returns empty with error hint)
- Timeout during OCR handled gracefully

### Integration Tests (`src/__tests__/ocr-integration.test.ts`)

**Mock-based integration tests (run on CI):**
- Use recorded screenshots as fixtures
- Mock the `adb` layer
- Test the full flow: find → screenshot → OCR → return results
- Validate integration logic without needing a real device

**Real device tests (local only, skipped on CI):**
- Marked with conditional `if (process.env.EMULATOR_AVAILABLE)`
- Run manually during development
- Find text visible on screen but not in accessibility tree
- Find text after scrolling
- Tap on OCR-found element successfully interacts with app
- Simulate the Chobani scenario: find sponsored ad by brand name

```typescript
// Runs on CI - uses fixture images
describe('OCR integration (mocked)', () => {
  it('finds text in Pinterest screenshot fixture', async () => {
    // Uses test/fixtures/pinterest-feed.png
  });
});

// Skipped on CI - requires emulator
const describeWithEmulator = process.env.EMULATOR_AVAILABLE
  ? describe
  : describe.skip;

describeWithEmulator('OCR integration (real device)', () => {
  it('finds text on live emulator screen', async () => {
    // Actual emulator interaction
  });
});
```

### Test Fixtures

- `test/fixtures/pinterest-feed.png` - Screenshot with mixed content
- `test/fixtures/clean-text.png` - Simple text for baseline
- `test/fixtures/no-text.png` - Image without text
- `test/fixtures/blurry-text.png` - Low quality text

## Future Work

| Feature | Description | Status |
|---------|-------------|--------|
| Icon recognition | Template matching for common UI icons (overflow menu, share, like, close, back, etc.) | Planned |
| Semantic image search | LLM-assisted visual understanding for non-text content ("the makeup ad") | Future |
| Native Tesseract support | Optional native binary for ~3x faster OCR | Future |
| OCR result caching | Cache extracted text until next interaction | Future |

## References

- [Chobani failure case video](/chobani_failure.mov) - Demonstrates the visual recognition failure
- [Visual Fallback Phase 1 Design](/docs/plans/2025-01-21-visual-fallback-design.md) - Screenshot + metadata fallback
- [MCP Server Design Guide](/Users/architjoshi/code/claude/mcp-writer/mcp-server-design-guide.md) - "One Tool = One Agent Step" principle
