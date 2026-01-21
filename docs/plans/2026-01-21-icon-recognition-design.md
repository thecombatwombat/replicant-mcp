# Icon Recognition Design

**Status:** Design complete
**Created:** 2026-01-21

## Problem Statement

OCR handles text, but many UI elements are icons without text labels: overflow menus (⋮ / ⋯), back arrows, search icons, close buttons, nav bar icons. The accessibility tree often has these elements with bounds but no descriptive text, or in some cases (ads, webviews), the accessibility tree has nothing useful at all.

We need a way to find and tap icons that balances:
- Speed (don't waste agent time)
- Accuracy (tap the right thing)
- Token efficiency (minimize LLM involvement)

## Solution: Three-Tier Icon Finding

Each tier is a fallback. Stop at first success.

| Tier | Name | Trigger | LLM? | Confidence |
|------|------|---------|------|------------|
| 1 | ResourceId Match | Query matches resourceId pattern | No | High |
| 2 | Visual Candidates | Unlabeled clickables exist | Yes (pick from list) | Medium |
| 3 | Grid Fallback | No accessibility data | Yes (2 picks) | Low |

### Flow

```
User: "tap the overflow menu"
         │
    [Tier 1] Search accessibility tree for resourceId ~ "overflow"
         │
    Found? → Calculate center from bounds → Tap → Done
         │ (not found)
    [Tier 2] Find unlabeled clickable elements
         │
    Found? → Crop each, return to LLM → LLM picks → Tap → Done
         │ (not found)
    [Tier 3] Take screenshot, overlay 4x6 grid
         │
    LLM picks cell → Show quadrant options → LLM refines → Tap → Done
```

## Tier 1: ResourceId Match

**Input:** User query like "overflow menu", "back button", "search icon"

**Process:**

1. Dump accessibility tree
2. Build search patterns from common icon names:
   - "overflow" → ["overflow", "more", "options", "menu", "dots"]
   - "back" → ["back", "navigate_up", "arrow_back", "return"]
   - "search" → ["search", "find", "magnify"]
   - "close" → ["close", "dismiss", "cancel", "x"]
   - "settings" → ["settings", "gear", "config", "preferences"]
3. Match against resourceId (case-insensitive, substring match)
4. If single match: Calculate center from bounds, tap directly
5. If multiple matches: Return list with positions for disambiguation

**No LLM needed** for matching. LLM only involved if disambiguation required.

## Tier 2: Visual Candidates

**Trigger:** Tier 1 found no resourceId matches, but accessibility tree has unlabeled clickable elements.

**Process:**

1. Filter accessibility tree for elements that are:
   - `clickable: true`
   - No `text` or `contentDesc`
   - Bounds indicate icon-sized region (20-80px width/height)
2. Take screenshot
3. Crop each candidate (max 64x64, JPEG 70% quality)
4. Return to LLM (max 6 candidates)
5. LLM picks by number → tap using pre-computed coordinates

## Tier 3: Grid Fallback

**Trigger:** Accessibility tree has no useful elements.

**Process:**

1. Take screenshot
2. Overlay 4x6 numbered grid (24 cells)
3. Return text description first (not full image):
   ```
   Grid cells (4x6):
   [1] Status bar area
   [2] App header
   ...
   ```
4. LLM picks cell
5. Show 5 refinement options for that cell:
   - [1] Top-left, [2] Top-right, [3] Center, [4] Bottom-left, [5] Bottom-right
6. LLM picks quadrant → calculate final coordinates → tap

## API Design

**New operation:** `ui { operation: "find-icon" }`

**Input schema:**
```typescript
{
  operation: "find-icon",
  query: string,              // e.g., "overflow menu", "back button"
  tier?: 1 | 2 | 3,           // Force specific tier (optional)
  cell?: number,              // For Tier 3 refinement (1-24)
  quadrant?: 1 | 2 | 3 | 4 | 5 // For Tier 3 final refinement
}
```

**Response examples:**

Tier 1 - Single match:
```json
{
  "tier": 1,
  "match": { "resourceId": "pin_overflow_action_id", "center": { "x": 498, "y": 241 } },
  "action": "ready_to_tap"
}
```

Tier 1 - Multiple matches:
```json
{
  "tier": 1,
  "matches": [
    { "index": 1, "resourceId": "pin_overflow_action_id", "center": { "x": 498, "y": 241 }, "region": "top-left" },
    { "index": 2, "resourceId": "pin_overflow_action_id", "center": { "x": 1033, "y": 775 }, "region": "top-right" }
  ],
  "action": "pick_index"
}
```

Tier 2 - Visual candidates:
```json
{
  "tier": 2,
  "candidates": [
    { "index": 1, "bounds": "[477,220][519,262]", "center": { "x": 498, "y": 241 }, "image": "<base64>" }
  ],
  "action": "pick_index"
}
```

Tier 3 - Grid selection:
```json
{
  "tier": 3,
  "gridDescription": "Grid cells (4x6): [1] Status bar...",
  "action": "pick_cell"
}
```

## Error Handling

**Core principle:** Fail fast, fail clearly. Never leave the LLM guessing.

| Scenario | Response |
|----------|----------|
| Empty accessibility tree | Skip to Tier 3, note: `"accessibility_unavailable": true` |
| Element off-screen | `"error": "element_off_screen", "suggestion": "Scroll to bring element into view"` |
| Query too vague | `"error": "ambiguous_query", "suggestion": "Be more specific"` |
| All tiers exhausted | `"error": "not_found", "suggestion": "Element may not exist on current screen"` |
| Timeout | `"error": "timeout", "phase": "...", "suggestion": "Device may be unresponsive"` |

## Effort Limits

**Per-tier limits:**

| Tier | Max Effort | Rationale |
|------|-----------|-----------|
| 1 | 1 attempt | ResourceId match is deterministic |
| 2 | 1 attempt | Present candidates once, LLM decides |
| 3 | 2 rounds | Grid → Cell → Quadrant. No endless refinement |

**Total operation budget:**
- Max 3 tool calls to resolve an icon find
- Max 10 seconds wall time before giving up
- No retry loops - return result, let caller decide next step

**Confidence levels:** `high` (Tier 1), `medium` (Tier 2), `low` (Tier 3)

## Token Efficiency

**Tier 2 optimizations:**
- Crop images max 64x64
- Use JPEG at 70% quality
- Limit to 6 candidates max
- Return text metadata first, images on request

**Tier 3 optimizations:**
- Send text grid description first, not full screenshot
- Only send zoomed cell image after LLM picks

**Sub-agent ready:** MCP returns data in a format suitable for delegation to a cheaper model (Haiku), but doesn't mandate it. Caller decides.

## Testing Strategy

**Unit tests:**
- ResourceId fuzzy matching
- Bounds parsing → center coordinate calculation
- Grid cell → bounds → quadrant → final coordinates
- Candidate filtering (clickable + no text + icon-sized)

**Integration tests:**
- Tier 1 → Tier 2 → Tier 3 fallthrough
- Single match vs multiple matches
- Error cases (timeout, not found, off-screen)

**Manual testing:**
- Pinterest overflow menus (Tier 1)
- Bottom nav icons (Tier 1)
- Ad content icons (Tier 2/3)
- WebView content (Tier 3)

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/tools/ui.ts` | Add find-icon operation |
| `src/services/icon-finder.ts` | Core tier logic |
| `src/services/grid.ts` | Grid overlay + coordinate calculation |
| `src/services/icon-patterns.ts` | ResourceId pattern mappings |
| `tests/unit/icon-finder.test.ts` | Unit tests |
| `tests/integration/icon-recognition.test.ts` | Integration tests |
| `README.md` | Update roadmap status |
| `.github/roadmap-mapping.yml` | Add mapping entry |
