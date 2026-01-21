# UI Automation Tools

## ui

Interact with app UI via accessibility tree.

**Operations:**
- `dump` - Get full accessibility tree
- `find` - Find elements by selector
- `tap` - Tap at coordinates
- `input` - Enter text
- `screenshot` - Capture screen
- `accessibility-check` - Quick accessibility assessment

**Selectors (for find):**
- `resourceId`: Match resource ID (partial)
- `text`: Match exact text
- `textContains`: Match partial text
- `className`: Match class name

**Example - Find and tap:**
```json
{ "operation": "find", "selector": { "text": "Login" } }
// Returns: { elements: [{ index: 0, centerX: 540, centerY: 1200, ... }] }

{ "operation": "tap", "x": 540, "y": 1200 }
// Or use elementIndex from previous find
{ "operation": "tap", "elementIndex": 0 }
```
