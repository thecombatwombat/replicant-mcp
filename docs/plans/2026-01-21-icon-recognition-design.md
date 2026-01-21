# Icon Recognition Design

**Status:** Design revised (v2)
**Created:** 2026-01-21
**Updated:** 2026-01-21

## Problem Statement

OCR handles text, but many UI elements are icons without text labels: overflow menus (⋮ / ⋯), back arrows, search icons, close buttons, nav bar icons. The accessibility tree often has these elements with bounds but no descriptive text, or in some cases (ads, webviews), the accessibility tree has nothing useful at all.

We need a way to find and tap icons that balances:
- Speed (don't waste agent time)
- Accuracy (tap the right thing)
- Token efficiency (minimize LLM involvement)

## Solution: Unified Fallback Chain

**Key architectural decision:** Icon recognition integrates into the existing `findWithOcrFallback` pattern rather than being a separate operation. This maintains API consistency and follows the "progressive disclosure" philosophy—callers don't need to know whether they're looking for text or icons.

### Extended Fallback Chain

```
ui { operation: "find", selector: { text: "overflow menu" } }
         │
    [1] Accessibility tree: text/contentDesc match
         │ (not found)
    [2] Accessibility tree: resourceId pattern match (NEW)
         │ (not found)
    [3] OCR: text search in screenshot
         │ (not found)
    [4] Visual candidates: unlabeled clickables (NEW)
         │ (not found)
    [5] Grid fallback: LLM-guided coordinate selection (NEW)
         │ (not found)
    Return empty results with suggestion
```

| Tier | Name | LLM? | Confidence | Source |
|------|------|------|------------|--------|
| 1 | Accessibility text match | No | High | `accessibility` |
| 2 | ResourceId pattern match | No | High | `accessibility` |
| 3 | OCR text search | No | High | `ocr` |
| 4 | Visual candidates | Yes (pick from list) | Medium | `visual` |
| 5 | Grid fallback | Yes (2 picks) | Low | `grid` |

## Tier 2: ResourceId Pattern Match

**Trigger:** No accessibility text match found.

**Process:**

1. Check if query matches known icon patterns
2. Search accessibility tree for resourceId substring matches
3. If single match: Return element with calculated center
4. If multiple matches: Return list for disambiguation

**Pattern mappings (extensible):**

```typescript
const ICON_PATTERNS: Record<string, string[]> = {
  // Navigation
  "overflow": ["overflow", "more", "options", "menu", "dots", "kabob", "meatball"],
  "back": ["back", "navigate_up", "arrow_back", "return", "nav_back"],
  "close": ["close", "dismiss", "cancel", "ic_close", "btn_close"],
  "home": ["home", "nav_home", "ic_home"],

  // Actions
  "search": ["search", "find", "magnify", "ic_search"],
  "settings": ["settings", "gear", "config", "preferences", "ic_settings"],
  "share": ["share", "ic_share", "btn_share"],
  "edit": ["edit", "pencil", "ic_edit", "btn_edit"],
  "delete": ["delete", "trash", "remove", "ic_delete"],
  "add": ["add", "plus", "create", "ic_add", "fab"],

  // Media
  "play": ["play", "ic_play", "btn_play"],
  "pause": ["pause", "ic_pause"],
  "refresh": ["refresh", "reload", "sync", "ic_refresh"],

  // Social
  "favorite": ["favorite", "heart", "like", "star", "ic_favorite"],
  "bookmark": ["bookmark", "save", "ic_bookmark"],
  "notification": ["notification", "bell", "ic_notification", "ic_notify"],

  // Misc
  "filter": ["filter", "ic_filter", "btn_filter"],
  "sort": ["sort", "ic_sort", "btn_sort"],
  "download": ["download", "ic_download"],
  "upload": ["upload", "ic_upload"],
  "profile": ["profile", "account", "avatar", "user", "ic_profile"],
  "hamburger": ["hamburger", "drawer", "nav_drawer", "ic_menu"],
};
```

This list covers ~90% of common Android icon interactions. Additional patterns can be added without code changes via configuration.

## Tier 4: Visual Candidates

**Trigger:** Tiers 1-3 found no matches, but accessibility tree has unlabeled clickable elements.

**Process:**

1. Filter accessibility tree for elements that are:
   - `clickable: true`
   - No `text` or `contentDesc`
   - Bounds indicate icon-sized region: **16-200px width/height, aspect ratio 0.5-2.0**
2. Take screenshot
3. Crop each candidate (max 128x128, JPEG 70% quality)
4. Return to LLM with images (max 6 candidates, selected top-to-bottom by Y coordinate, then left-to-right by X)
5. If >6 candidates exist, include `"truncated": true` and `"totalCandidates": N` in response
6. LLM picks by index → return element for tap

**Size constraints rationale:** Material Design icons are typically 24dp or 48dp. At 3.5x density (Pixel 7), this is 84-168px. The 16-200px range covers:
- Minimum: small status icons (~16px)
- Maximum: large FABs and nav icons at high density (~168px + padding)
- Aspect ratio 0.5-2.0: excludes wide banners and tall lists

## Tier 5: Grid Fallback

**Trigger:** Accessibility tree has no useful elements (empty or all non-clickable).

**Process:**

1. Take screenshot
2. Overlay 4x6 numbered grid (24 cells)
3. **Return grid-overlaid image directly** (no text-first—text descriptions require vision anyway)
4. LLM picks cell (1-24)
5. Return 5 refinement options for that cell:
   - [1] Top-left, [2] Top-right, [3] Center, [4] Bottom-left, [5] Bottom-right
6. LLM picks position → calculate final coordinates → return for tap

**Why 5 positions, not 9:** For v1, 5 positions provide sufficient precision for most icon taps. Each grid cell is ~90x130px on a 1080x1920 screen. 5-way refinement gives ~45x65px precision—smaller than most tap targets. A 3x3 sub-grid adds complexity without proportional benefit. Can revisit if real-world usage shows precision issues.

## API Design

**No new operation.** Icon recognition extends the existing `find` operation.

**Existing call (unchanged):**
```typescript
ui { operation: "find", selector: { text: "Login" } }
```

**Now also handles icons automatically:**
```typescript
ui { operation: "find", selector: { text: "overflow menu" } }
// → Tries accessibility → resourceId patterns → OCR → visual → grid
```

**New optional parameters for grid refinement:**
```typescript
ui {
  operation: "find",
  selector: { text: "overflow menu" },
  gridCell?: number,      // For Tier 5 refinement (1-24)
  gridPosition?: 1 | 2 | 3 | 4 | 5  // For Tier 5 final refinement
}
```

**Schema location:** Add to `uiInputSchema` in `src/tools/ui.ts`:
```typescript
gridCell: z.number().min(1).max(24).optional(),
gridPosition: z.number().min(1).max(5).optional(),
```

**Response schema (extended):**
```typescript
interface FindResult {
  elements: Element[];
  // Tiers 1 & 2 both return "accessibility" (same tree, different matching strategy)
  // The tier field differentiates: tier=1 is text match, tier=2 is resourceId pattern match
  source: "accessibility" | "ocr" | "visual" | "grid";

  // New fields for icon recognition
  tier?: 1 | 2 | 3 | 4 | 5;
  confidence?: "high" | "medium" | "low";

  // For visual candidates (Tier 4)
  candidates?: Array<{
    index: number;
    bounds: string;
    center: { x: number; y: number };
    image: string; // base64
  }>;

  // For grid fallback (Tier 5)
  gridImage?: string; // base64, grid-overlaid screenshot
  gridCell?: number;  // Selected cell for refinement
  gridPositions?: string[]; // ["Top-left", "Top-right", "Center", ...]

  // For Tier 4 truncation
  truncated?: boolean;
  totalCandidates?: number;
}
```

**Type migration:** Rename `FindWithOcrResult` → `FindWithFallbacksResult` in `src/adapters/ui-automator.ts`. The new fields are all optional, so existing code returning `{ elements, source }` remains valid. No breaking change to callers.

## Error Handling

**Core principle:** Fail fast, fail clearly. Never leave the LLM guessing.

| Scenario | Response |
|----------|----------|
| Empty accessibility tree (text selector) | Skip Tiers 1-2 & 4, try OCR (Tier 3) then Grid (Tier 5). Note: `"accessibility_unavailable": true` |
| Empty accessibility tree (non-text selector) | Skip directly to Grid (Tier 5). OCR requires text-based selectors. |
| Element off-screen | `"error": "element_off_screen", "suggestion": "Scroll to bring element into view"` |
| Ambiguous query | `"error": "ambiguous_query", "matchCount": N, "suggestion": "Be more specific"` |
| All tiers exhausted | `"error": "not_found", "suggestion": "Element may not exist on current screen"` |
| Timeout | `"error": "timeout", "phase": "...", "suggestion": "Device may be unresponsive"` |

**Ambiguous query criteria:**
- **>6 resourceId matches**: Too many candidates to present visually
- **Matches in >3 distinct screen regions**: Icon appears in multiple places, need location hint
- Region = quadrant of screen (top-left, top-right, bottom-left, bottom-right)

## Effort Limits

**Per-tier limits:**

| Tier | Max Effort | Rationale |
|------|-----------|-----------|
| 1-3 | 1 attempt each | Deterministic matching |
| 4 | 1 attempt | Present candidates once, LLM decides |
| 5 | 2 rounds | Grid → Cell → Position. No endless refinement |

**Total operation budget:**
- Max 3 tool calls to resolve (initial find + cell selection + position selection)
- Max 10 seconds wall time before giving up
- No retry loops - return result, let caller decide next step

**Confidence levels:**
- `high`: Tiers 1-3 (deterministic matching)
- `medium`: Tier 4 (LLM picks from bounded candidates)
- `low`: Tier 5 (LLM picks from grid)

## Token Efficiency

**Token calculation basis:** ~330 tokens per KB for JPEG images (Claude's vision token rate). All estimates rounded to nearest thousand for readability.

**Tier 4 (Visual Candidates):**
- Crop images: 128x128 max (scaled from bounds)
- JPEG at 70% quality: ~2-4KB per image → ~660-1,320 tokens per image
- 6 candidates max: **12-24KB total → ~4,000-8,000 tokens**
- Compare to full 1080p screenshot: ~200KB → ~65,000 tokens
- **Savings: 85-95% vs full screenshot**

**Tier 5 (Grid Fallback):**
- Full screenshot with grid overlay: ~200KB → ~65,000 tokens
- Zoomed cell image (after selection): ~15KB → ~5,000 tokens
- **Total for 2-round flow: ~70,000 tokens**
- This is expensive but only triggers when accessibility tree is empty (ads, webviews)

**Sub-agent ready:** Response format supports delegation to cheaper models (Haiku) for Tiers 4-5, but doesn't mandate it. Caller decides.

## Implementation Notes

### Extending findWithOcrFallback

Rename to `findWithFallbacks` and extend the chain:

```typescript
async findWithFallbacks(
  deviceId: string,
  selector: { text?: string; textContains?: string; resourceId?: string; className?: string },
  options: FindOptions = {}
): Promise<FindWithFallbacksResult> {
  // Tier 1: Accessibility text match (existing)
  // Tier 2: ResourceId pattern match (new)
  // Tier 3: OCR (existing)
  // Tier 4: Visual candidates (new)
  // Tier 5: Grid fallback (new)
}
```

**Breaking change note:** The rename from `findWithOcrFallback` → `findWithFallbacks` is internal to `ui-automator.ts`. The public `ui { operation: "find" }` API is unchanged. Since this is a minor version (pre-1.0), no deprecation shim is needed—just update the internal call site in `src/tools/ui.ts`.

### Why Not a Separate Operation?

Greptile correctly identified that a separate `find-icon` operation would:
1. Break API consistency with the existing OCR fallback pattern
2. Force callers to know ahead of time whether they're looking for an icon
3. Contradict the "progressive disclosure" philosophy

By integrating into the existing `find` operation, the LLM can simply ask to "find the overflow menu" and the system handles the complexity of determining how to locate it.

## Testing Strategy

**Unit tests:**
- ResourceId fuzzy matching against pattern list
- Bounds parsing → center coordinate calculation
- Grid cell → bounds → position → final coordinates
- Candidate filtering (clickable + no text + size constraints)
- Ambiguous query detection (>6 matches, >3 regions)

**Integration tests:**
- Full fallback chain: Tier 1 → 2 → 3 → 4 → 5
- Single match vs multiple matches at each tier
- Error cases (timeout, not found, off-screen)
- Grid refinement flow

**Manual testing:**
- Pinterest overflow menus (Tier 2)
- Bottom nav icons (Tier 2)
- Ad content icons (Tier 4/5)
- WebView content (Tier 5)

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/adapters/ui-automator.ts` | Rename `findWithOcrFallback` → `findWithFallbacks`, add Tiers 2/4/5 |
| `src/services/icon-patterns.ts` | ResourceId pattern mappings |
| `src/services/grid.ts` | Grid overlay + coordinate calculation |
| `src/services/visual-candidates.ts` | Candidate filtering and cropping |
| `tests/unit/icon-patterns.test.ts` | Pattern matching tests |
| `tests/unit/grid.test.ts` | Grid coordinate tests |
| `tests/integration/icon-recognition.test.ts` | Full fallback chain tests |
| `README.md` | Update roadmap status |
| `.github/roadmap-mapping.yml` | Add mapping entry |

## Design Decisions Log

### Addressed from review feedback:
1. **Integrated into existing fallback chain** - No separate `find-icon` operation
2. **Fixed size constraints** - 16-200px with aspect ratio 0.5-2.0 (was 20-80px)
3. **Fixed Tier 5 logic** - Send grid image directly, dropped text-first approach
4. **Added token cost estimates** - Concrete numbers for implementers
5. **Expanded pattern mappings** - 20+ icon types (was 5)
6. **Added ambiguous query criteria** - >6 matches OR >3 distinct regions

### Intentionally not addressed:
1. **3x3 sub-grid for refinement** - 5 positions sufficient for v1; adds complexity without proportional benefit
2. **Pattern-learning system** - Hardcoded patterns with substring matching cover 90%+ of cases; ML-based pattern learning is overengineering for this scope
