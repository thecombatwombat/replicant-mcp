# UI Dump Pagination Design

**Issue:** replicant-mcp-1un
**Date:** 2026-01-26
**Status:** Approved

## Problem

`ui dump` returns all interactive elements, which can be 50+ on complex apps like Pinterest. Each dump is ~8KB, and with 13 dumps in a session that's 108KB (32% of context).

## Solution

Add pagination to `ui dump` matching the pattern used for `adb-app list`.

## Schema Changes

### Input Parameters

```typescript
// New optional parameters for dump operation
limit: number    // Max elements to return (default: 20, max: 100)
offset: number   // Skip first N elements for pagination
```

### Response Format

```typescript
{
  dumpId: string,
  elements: Array<{
    text?: string,
    type: string,
    x: number,
    y: number,
    resourceId?: string
  }>,
  count: number,        // Elements returned in this response
  totalCount: number,   // Total interactive elements available
  hasMore: boolean,     // More elements available via offset
  offset: number,
  limit: number,
  deviceId: string,
  hint?: string,        // Guidance for next action
  warning?: string      // For empty dumps
}
```

## Decision Guidance

Response includes contextual hints:

| Condition | Hint/Warning |
|-----------|--------------|
| `hasMore: true` | "20 of 54 elements shown. Use 'ui find' with selector for specific elements, or offset for more." |
| `totalCount: 0` | "No accessibility nodes found. Use 'ui screenshot' instead - app may use custom rendering." |
| `hasMore: false` | No hint needed |

## Implementation

### Files to Modify

1. **`src/tools/ui.ts`**
   - Add `limit` and `offset` to input schema
   - Update dump case to paginate interactive elements
   - Add hint generation logic

2. **Tool definition update**
   - Add parameter descriptions for limit/offset

### Key Logic

```typescript
case "dump": {
  const tree = await context.ui.dump(deviceId);
  const flat = flattenTree(tree);
  const interactive = flat.filter((n) => n.clickable || n.focusable);

  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const paginated = interactive.slice(offset, offset + limit);
  const hasMore = offset + limit < interactive.length;

  return {
    dumpId,
    elements: paginated.map(formatElement),
    count: paginated.length,
    totalCount: interactive.length,
    hasMore,
    offset,
    limit,
    deviceId,
    hint: hasMore
      ? `${paginated.length} of ${interactive.length} elements shown. Use 'ui find' for specific elements, or offset for more.`
      : undefined,
    warning: interactive.length === 0 ? EMPTY_DUMP_WARNING : undefined,
  };
}
```

## Testing

- Update existing dump tests to expect pagination fields
- Test offset/limit behavior
- Test hasMore flag accuracy
- Test empty dump warning preserved

## Context Savings

- Before: ~8KB per dump (50 elements)
- After: ~3KB per dump (20 elements)
- Estimated 60% reduction in dump-related context usage
