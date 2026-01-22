# UI Automation Tools

## ui

Interact with app UI via accessibility tree with intelligent fallback.

**Operations:**
- `dump` - Get full accessibility tree
- `find` - Find elements by selector (with OCR/visual fallback)
- `tap` - Tap at coordinates, element index, or grid cell
- `input` - Enter text
- `screenshot` - Capture screen to file
- `accessibility-check` - Quick accessibility assessment
- `visual-snapshot` - Get screenshot + screen/app metadata

**Selectors (for find):**
- `resourceId`: Match resource ID (partial)
- `text`: Match exact text
- `textContains`: Match partial text
- `className`: Match class name
- `nearestTo`: Find elements nearest to this text (spatial proximity)

**Tap options:**
- `x`, `y`: Direct coordinates
- `elementIndex`: Index from previous find result
- `gridCell`: Grid cell 1-24 (6x4 grid overlay)
- `gridPosition`: Position within cell (1=TL, 2=TR, 3=Center, 4=BL, 5=BR)

**Optional parameters:**
- `debug`: Include source (accessibility/ocr) and confidence scores
- `inline`: Return base64 screenshot in response (for screenshot op)
- `localPath`: Custom path for screenshot output

**Fallback chain:**
1. Accessibility tree (fast, reliable)
2. OCR via Tesseract (when accessibility fails)
3. Visual snapshot (screenshot + metadata for AI vision)

**Example - Find and tap:**
```json
{ "operation": "find", "selector": { "text": "Login" } }
// Returns: { elements: [{ index: 0, centerX: 540, centerY: 1200, ... }] }

{ "operation": "tap", "elementIndex": 0 }
```

**Example - Spatial proximity:**
```json
{ "operation": "find", "selector": { "textContains": "edit", "nearestTo": "John" } }
// Returns elements containing "edit", sorted by distance to "John"
```

**Example - Grid-based tap (for icons):**
```json
{ "operation": "tap", "gridCell": 12, "gridPosition": 3 }
// Taps center of cell 12 in the 24-cell grid overlay
```
