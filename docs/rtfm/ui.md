# UI Automation Tools

## ui-query

Query the UI accessibility tree and find elements.

**Operations:**
- `dump` - Get full accessibility tree
- `find` - Find elements by selector (with OCR/visual fallback)
- `accessibility-check` - Quick accessibility assessment

**Selectors (for find):**
- `resourceId`: Match resource ID (partial)
- `text`: Match exact text
- `textContains`: Match partial text
- `className`: Match class name
- `nearestTo`: Find elements nearest to this text (spatial proximity)

**Fallback chain:**
1. Accessibility tree (fast, reliable)
2. ResourceId pattern match (icon/button patterns)
3. OCR via Tesseract
4. Visual candidates (cropped unlabeled clickables)
5. Grid fallback (large payload; use only when needed)

**Optional parameters:**
- `debug`: Include source (accessibility/ocr) and confidence scores
- `maxTier`: Maximum fallback tier to attempt (1-5). Use `3` to avoid visual/grid image payloads.

**Recommended caller pattern:**
```json
{ "operation": "find", "selector": { "text": "Login" }, "maxTier": 3 }
```
This keeps routine searches text-first and avoids tier 4/5 visual payloads unless you explicitly opt in.

**Example - Find elements:**
```json
{ "operation": "find", "selector": { "text": "Login" } }
// Returns: { elements: [{ index: 0, centerX: 540, centerY: 1200, ... }] }
```

**Example - Spatial proximity:**
```json
{ "operation": "find", "selector": { "textContains": "edit", "nearestTo": "John" } }
// Returns elements containing "edit", sorted by distance to "John"
```

## ui-action

Tap, input text, and scroll on the device UI.

**Operations:**
- `tap` - Tap at coordinates, element index, or grid cell
- `input` - Enter text
- `scroll` - Scroll the screen

**Tap options:**
- `x`, `y`: Direct coordinates
- `elementIndex`: Index from previous find result
- `gridCell`: Grid cell 1-24 (6x4 grid overlay)
- `gridPosition`: Position within cell (1=TL, 2=TR, 3=Center, 4=BL, 5=BR)

**Example - Cross-tool find and tap:**
```json
// Step 1: Use ui-query to find the element
ui-query: { "operation": "find", "selector": { "text": "Login" } }
// Returns: { elements: [{ index: 0, centerX: 540, centerY: 1200, ... }] }

// Step 2: Use ui-action to tap it
ui-action: { "operation": "tap", "elementIndex": 0 }
```

**THE-112: stale-element protection.** At find time, ui-query captures a
content fingerprint (text + resourceId + className + bounds) of each
accessibility match. When ui-action consumes `elementIndex`, it re-dumps the
tree and rejects with `STALE_ELEMENT_INDEX` if the node at the cached center
has changed (text differs, bounds shifted, or no node is there anymore).
Re-run `ui-query find` after a scroll, dialog dismiss, or any screen
transition. OCR/grid matches skip the check (no stable identity).

**Example - Grid-based tap (for icons):**
```json
{ "operation": "tap", "gridCell": 12, "gridPosition": 3 }
// Taps center of cell 12 in the 24-cell grid overlay
```

## ui-capture

Capture screenshots and visual snapshots of the device screen.

**Operations:**
- `screenshot` - Capture screen to file
- `visual-snapshot` - Get screenshot + screen/app metadata

**Optional parameters:**
- `inline`: Return base64 screenshot in response
- `localPath`: Custom path for screenshot output

### Scaling Modes

| Mode | Parameter | Behavior |
|------|-----------|----------|
| Default | (none) | Scale to 800px max |
| Custom | `maxDimension: 1500` | Scale to specified size |
| Raw | `raw: true` | No scaling (may exceed API limits) |

### Response Format

Screenshot responses now include scaling metadata:

```json
{
  "mode": "file",
  "path": ".replicant/screenshots/screenshot-1234.png",
  "device": { "width": 1080, "height": 2400 },
  "image": { "width": 360, "height": 800 },
  "scaleFactor": 3
}
```

## Screenshot Scaling

Screenshots are automatically scaled to fit within 800px (longest side) by default.
This prevents API context limits and reduces token usage.

**All coordinates are in image space.** Tap coordinates are automatically converted
to device coordinates. You don't need to do any math.

### When to Use Raw Mode

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
