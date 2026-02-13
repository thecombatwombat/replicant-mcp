# Harness Problem Audit: replicant-mcp

**Date:** 2026-02-13
**Scope:** All MCP tools in `src/tools/`, focusing on UI automation
**Framework:** "The Harness Problem" — most agent failures are expression failures, not reasoning failures. Fix: stable identifiers, minimal reproduction burden, structured diffs, clean failure modes.

---

## Executive Summary

replicant-mcp already does several things well: the progressive disclosure pattern (summary + cache ID + details-on-demand) is used consistently across gradle and logcat tools, error handling uses structured `ReplicantError` with suggestion fields, and the 5-tier find fallback chain is thoughtful.

However, the **UI automation tools have three critical harness problems** that likely cause the majority of model failures:

1. **Positional index references for elements** — The model must hold a mental map between array position and element identity. Indices are ephemeral, invalidated by any screen change, and provide zero self-describing context.
2. **No post-action state feedback** — After tap/scroll/input, the model gets back only `{ tapped: { x, y } }` with no indication of what changed on screen. The model must issue a separate dump to see the effect, wasting a turn and tokens.
3. **Full tree re-dumps with no diffing** — Every `ui dump` returns the entire accessibility tree. The model must re-parse hundreds of nodes to find what changed after an action.

Fixing these three issues would likely improve success rates by 10-20% across all models, based on the blog post's finding that a single tool format change improved 15 LLMs by 5-14 points.

---

## Per-Tool Audit

### 1. `ui find` → `ui tap` (Element Addressing)

**Current behavior:** `ui find` returns elements with sequential `index` fields (0, 1, 2...) and stores them in `context.lastFindResults[]`. `ui tap` accepts `elementIndex` to reference a previous find result by array position.

**Failure mode:** Indices are fragile positional references that break if: (a) the model calls find again (results overwritten), (b) the screen changes between find and tap, (c) the model confuses index 2 with the 3rd element vs the element with `index: 2`. The model also has no way to verify it's tapping the right thing — index `3` carries no semantic meaning.

**Proposed change:** Assign each found element a short content-hashed ID derived from its identifying properties (text + resourceId + className + bounds). Return these as `id` fields. Accept `elementId` in tap/input operations. Validate that the ID still resolves to the same element at tap time (re-dump and verify).

```typescript
// Current find response:
{ elements: [{ index: 0, text: "Login", centerX: 540, centerY: 1200, ... }] }

// Proposed find response:
{ elements: [{ id: "e_a3f2", text: "Login", centerX: 540, centerY: 1200, ... }] }

// Current tap:
{ operation: "tap", elementIndex: 0 }

// Proposed tap:
{ operation: "tap", elementId: "e_a3f2" }
// On tap, re-resolve ID: hash current tree, find matching element, tap its center.
// If element gone: return structured error with what IS on screen now.
```

**ID generation sketch:**
```typescript
function elementId(node: AccessibilityNode): string {
  // Hash the stable identity of the element
  const identity = `${node.text}|${node.resourceId}|${node.className}|${node.bounds.left},${node.bounds.top}`;
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 4);
  return `e_${hash}`;
}
```

**Priority:** **HIGH** — This is the single highest-leverage change. Every tap operation currently requires the model to hold ephemeral positional state. Content-hashed IDs make element references self-verifying and robust across screen states.

---

### 2. `ui tap` / `ui scroll` / `ui input` (No Post-Action State)

**Current behavior:** Action operations return minimal confirmation: `{ tapped: { x: 540, y: 1200 } }`, `{ scrolled: { direction: "down", amount: 0.5 } }`, `{ input: "hello" }`. The model has no idea what happened on screen.

**Failure mode:** The model must always follow every action with a separate `ui dump` or `ui find` call to see the result. This doubles the number of tool calls for every interaction, wastes tokens, and creates a gap where the model must decide whether to dump or find next — a decision point that can go wrong. The model also can't detect if a tap did nothing (e.g., tapped a non-interactive area).

**Proposed change:** Every action operation should automatically capture a lightweight post-action state snapshot and return it inline. Use the compact dump format (interactive elements only) with a brief diff against the pre-action state.

```typescript
// Current tap response:
{ tapped: { x: 540, y: 1200 }, deviceId: "emulator-5554" }

// Proposed tap response:
{
  tapped: { x: 540, y: 1200, elementId: "e_a3f2", text: "Login" },
  stateAfter: {
    dumpId: "ui-dump-abc123",
    changed: true,
    summary: "Screen changed: 'Login' → 'Dashboard'. 12 interactive elements.",
    newElements: [{ id: "e_b7c1", text: "Welcome", type: "TextView" }],
    removedElements: [{ id: "e_a3f2", text: "Login" }],
    interactiveCount: 12,
  },
  deviceId: "emulator-5554"
}
```

For scroll, include whether new content appeared (critical for knowing when to stop scrolling):
```typescript
{
  scrolled: { direction: "down", amount: 0.5 },
  stateAfter: {
    dumpId: "ui-dump-def456",
    changed: true,
    newElementsVisible: 4,
    reachedEnd: false,  // no new content = end of list
    summary: "4 new elements visible after scroll. 18 total interactive.",
  }
}
```

**Priority:** **HIGH** — Eliminates the mandatory dump-after-every-action pattern. Reduces tool calls by ~50% for UI automation workflows and gives the model immediate feedback on whether its action had the intended effect.

---

### 3. `ui dump` (Full Tree, No Diffing)

**Current behavior:** Both full and compact dump modes return the entire accessibility tree state. Full mode returns nested nodes with all properties. Compact mode returns a flat list of interactive elements with pagination.

**Failure mode:** After a scroll or navigation, the model gets back 50-200 nodes and must re-scan everything to figure out what changed. This is token-wasteful and error-prone — the model may miss a subtle change (like a button becoming enabled) because it's buried in an unchanged tree. Compact mode helps with volume but still forces full re-parsing.

**Proposed change:** Add a `since` parameter that accepts a previous `dumpId`. When provided, return only the delta: added elements, removed elements, and changed elements (with before/after for changed properties).

```typescript
// Request:
{ operation: "dump", since: "ui-dump-abc123" }

// Response:
{
  dumpId: "ui-dump-def456",
  delta: {
    added: [{ id: "e_c8d2", text: "New Item", type: "TextView", ... }],
    removed: [{ id: "e_a3f2" }],
    changed: [{ id: "e_b7c1", changes: { text: { from: "Loading...", to: "Ready" } } }],
  },
  interactiveCount: 15,
  totalCount: 87,
  deviceId: "emulator-5554"
}

// If no previous dump or dumpId expired, fall back to full dump transparently.
```

**Priority:** **MEDIUM** — Significant token savings and better model comprehension of state changes. Lower priority than the first two because the model can work around this with compact mode + find. But for complex multi-step automation flows, this becomes critical.

---

### 4. `ui find` (Element Not Found → Recovery)

**Current behavior:** When no elements match a selector, `ui find` returns `{ elements: [], count: 0 }` and may include a `visualFallback` with a screenshot. When `ui tap` is called with an invalid `elementIndex`, it throws `ELEMENT_NOT_FOUND` with the message "Element at index N not found. Run 'find' first."

**Failure mode:** The error for stale references says "Run 'find' first" but doesn't tell the model what IS currently on screen. The model must make a recovery call (dump or find) before it can figure out what to do next. For find-returning-empty, the visual fallback is good but the model still has to re-plan from scratch. Neither error path gives the model enough context to recover in one turn.

**Proposed change:** When an element reference fails (stale ID, element gone), automatically capture current screen state and return it in the error response. The model can recover immediately without an extra tool call.

```typescript
// Current error:
{ error: "ELEMENT_NOT_FOUND", message: "Element at index 3 not found. Run 'find' first." }

// Proposed error:
{
  error: "ELEMENT_STALE",
  message: "Element e_a3f2 ('Login' Button) no longer on screen.",
  currentState: {
    dumpId: "ui-dump-ghi789",
    screen: "Dashboard",
    interactiveElements: [
      { id: "e_x1y2", text: "Settings", type: "Button" },
      { id: "e_z3w4", text: "Profile", type: "Button" },
      // ... compact list
    ],
    interactiveCount: 8,
    hint: "Screen appears to have navigated. The element may have been tapped successfully before the screen changed."
  }
}
```

**Priority:** **HIGH** — Stale reference errors are one of the most common failure modes in UI automation. Giving the model current state in the error response eliminates the retry-dump-retry cycle and enables single-turn recovery.

---

### 5. `ui dump` compact mode (Elements Lack IDs)

**Current behavior:** Compact dump returns elements as `{ text, type, x, y, resourceId }` — no index, no ID, just coordinates and text.

**Failure mode:** The model must reconstruct which element to act on from text content and coordinates. If two elements share the same text (e.g., two "OK" buttons, multiple list items), the model has no way to disambiguate except by coordinates. Coordinates are fragile — they change with scroll position and screen rotation.

**Proposed change:** Add content-hashed `id` fields to compact dump elements, consistent with the IDs used in find results and tap targets.

```typescript
// Current compact element:
{ text: "Login", type: "Button", x: 540, y: 1200, resourceId: "btn_login" }

// Proposed compact element:
{ id: "e_a3f2", text: "Login", type: "Button", x: 540, y: 1200, resourceId: "btn_login" }
```

**Priority:** **HIGH** — Compact dump is the most common way models interact with the accessibility tree. Without IDs, the model must use text matching or coordinates for every interaction, which is exactly the fragile reproduction burden the harness problem describes.

---

### 6. `adb-logcat` (Progressive Disclosure Already Good, Missing Structured Parsing)

**Current behavior:** Returns `{ logId, summary: { lineCount, errorCount, warnCount }, preview: <first 20 lines> }`. Full output available via `gradle-get-details` with the logId.

**Failure mode:** The preview is raw text — the model must parse timestamps, tags, PIDs, and levels from unstructured logcat format. When debugging a crash, the model often needs the stack trace, not the first 20 lines (which may be irrelevant noise before the crash).

**Proposed change:** Structure the preview into parsed log entries. Prioritize crash/exception lines over chronological order.

```typescript
// Current:
{ preview: "01-15 10:30:00.123 1234 E AndroidRuntime: FATAL EXCEPTION: main\n..." }

// Proposed:
{
  logId: "logcat-abc123",
  summary: { lineCount: 100, errorCount: 3, warnCount: 7 },
  crashes: [{
    exception: "java.lang.NullPointerException",
    message: "Attempt to invoke virtual method on null object",
    location: "com.example.app.MainActivity.onCreate(MainActivity.java:42)",
    timestamp: "01-15 10:30:00.123"
  }],
  recentErrors: [
    { tag: "AndroidRuntime", message: "FATAL EXCEPTION: main", timestamp: "..." },
    { tag: "ActivityManager", message: "Force finishing activity", timestamp: "..." },
  ],
  preview: "..." // still available as fallback
}
```

**Priority:** **MEDIUM** — Logcat is a high-frequency tool during debugging. Structured crash info would let the model jump straight to the relevant code location instead of parsing raw text. But the current preview + details pattern is already functional.

---

### 7. `adb-shell` (Freeform Command = Maximum Reproduction Burden)

**Current behavior:** Accepts a freeform `command` string. Returns raw `{ stdout, stderr, exitCode }`.

**Failure mode:** This is the ultimate harness problem — the model must construct arbitrary shell commands as strings, with all the escaping, quoting, and syntax issues that entails. Every character in the command is a potential failure point. The response is also unstructured text.

**Proposed change:** This tool is intentionally a catch-all escape hatch, so making it fully structured isn't realistic. However, two improvements would help:
1. Add a `hint` to common failure patterns (permission denied → suggest `run-as`, command not found → suggest alternatives)
2. For known command patterns (am, pm, settings, dumpsys), auto-parse the output into structured data

```typescript
// Current response for `dumpsys battery`:
{ stdout: "Current Battery Service state:\n  AC powered: false\n  USB powered: true\n  ...", exitCode: 0 }

// Proposed: detect known commands and add structured overlay
{
  stdout: "...",
  exitCode: 0,
  parsed: {
    type: "battery",
    acPowered: false,
    usbPowered: true,
    level: 85,
    status: "charging"
  }
}
```

**Priority:** **LOW** — adb-shell is deliberately the escape hatch. Models that need specific device info should ideally use higher-level tools. But the smart hint system for common errors would be a quick win.

---

### 8. `gradle-build` / `gradle-test` (Already Good Pattern)

**Current behavior:** Returns summary with cache ID. `gradle-build` returns `{ buildId, summary: { success, duration, warnings, errors, apkPath, tasksExecuted } }`. `gradle-test` returns `{ testId, summary: { passed, failed, skipped, total, duration }, failures, regressions }`.

**Failure mode:** Minimal. The progressive disclosure pattern works well here. The main gap is that `failures` in gradle-test contains structured test failure info (test name, message) but `errors` in gradle-build is just a count — the model must call `gradle-get-details` with `detailType: "errors"` to see what went wrong.

**Proposed change:** Include the first 3-5 error messages inline in the build response, same as test failures are included inline in test response.

```typescript
// Current build failure:
{ buildId: "...", summary: { success: false, errors: 3, ... } }

// Proposed:
{ buildId: "...", summary: { success: false, errors: 3, ... },
  topErrors: [
    { file: "MainActivity.kt", line: 42, message: "Unresolved reference: foo" },
    { file: "Utils.kt", line: 17, message: "Type mismatch: inferred type..." },
  ]
}
```

**Priority:** **LOW** — The current pattern already works. Inlining top errors would save one tool call on build failures but isn't a major source of model confusion.

---

### 9. `gradle-get-details` (Cache Miss Recovery)

**Current behavior:** When the cache ID has expired, throws `CACHE_MISS` with message "The cache entry may have expired. Re-run the build/test operation."

**Failure mode:** The model must re-run the entire build/test just to see details. This is expensive (minutes for builds) and may produce different results.

**Proposed change:** The suggestion is already correct — there's not much to do when the cache expires. But the error could include the cache stats to help the model understand TTLs: "Entry expired after 5m. Current cache: 3/50 entries. Re-run the operation to get fresh results."

**Priority:** **LOW** — Rare failure mode, recovery path is clear.

---

### 10. `adb-app list` (Good Pattern, Minor Enhancement)

**Current behavior:** Returns paginated package list with `{ packages, count, totalCount, hasMore, offset, limit, cacheId }`.

**Failure mode:** Minimal. Pagination is well-implemented. The only issue is that package names are opaque strings — the model may not know which package corresponds to which app.

**Proposed change:** For the first page, include app labels (human-readable names) alongside package names.

```typescript
// Current:
{ packages: ["com.example.app", "com.google.android.gms", ...] }

// Proposed:
{ packages: [
  { package: "com.example.app", label: "My App" },
  { package: "com.google.android.gms", label: "Google Play Services" },
] }
```

**Priority:** **LOW** — Package names are usually sufficient. Labels would be nice but require an extra `dumpsys` call per package.

---

### 11. `emulator-device` (Already Clean)

**Current behavior:** Clean operation dispatch with structured responses. Snapshot operations use names (stable identifiers), emulator start returns the emulator ID.

**Failure mode:** Minimal. The tool follows good patterns. Auto-selecting the started emulator as the current device is a good UX touch.

**Proposed change:** None significant. Could add a `status` field to running emulators in list (booting, ready, etc.) but this is marginal.

**Priority:** **LOW** — Already well-designed.

---

### 12. `adb-device` (Already Clean)

**Current behavior:** Lists devices, selects active device, returns structured properties with cache ID for full property set.

**Failure mode:** Minimal. Auto-selection when single device is good. Health-check provides actionable diagnostics.

**Proposed change:** None significant.

**Priority:** **LOW** — Already well-designed.

---

## Cross-Cutting Issues

### A. `lastFindResults` Is Server-Side Mutable State

**Current behavior:** `context.lastFindResults` is an array that gets overwritten every time `ui find` is called. `ui tap` references elements by index into this array.

**Failure mode:** This is implicit shared mutable state between tool calls. If the model (or the user in a multi-turn conversation) calls find twice, the first results are silently destroyed. There's no way to reference elements from an earlier find. The model has no way to know what `lastFindResults` currently contains.

**Proposed change:** Replace with the element ID system. Elements are identified by content hash, not by position in a transient array. The server can maintain a cache of recently-seen elements (keyed by ID) with TTLs, but the model never needs to know about the cache — it just uses IDs.

```typescript
// Replace context.lastFindResults with:
context.elementCache: Map<string, { element: FindElement, seenAt: number, dumpId: string }>
```

**Priority:** **HIGH** — This is the root cause of the element addressing problem. Every other element-related fix depends on eliminating `lastFindResults`.

---

### B. No Consistent `dumpId` Threading

**Current behavior:** `ui dump` returns a `dumpId`, but `ui find` doesn't reference or return one. `ui tap` doesn't accept or return one. There's no way to correlate which dump state a find result came from.

**Failure mode:** The model can't track state transitions. After dump → find → tap → dump, there's no way to ask "what changed between my first dump and this one?"

**Proposed change:** All UI operations should thread `dumpId` — every operation that reads or writes screen state should return the dumpId of the state it observed, and accept `since: dumpId` for diffing.

**Priority:** **MEDIUM** — Enables the state diffing feature. Low cost to add since dump already generates IDs.

---

### C. Compact Dump Pagination vs. Element IDs

**Current behavior:** Compact dump uses `offset/limit` pagination over interactive elements, returning coordinates but no IDs.

**Failure mode:** The model can't directly act on elements from a compact dump — it must either call `find` (to get something into `lastFindResults`) or use raw x/y coordinates. The compact dump is a read-only view with no action path.

**Proposed change:** With element IDs on compact dump elements, the model can go directly from dump to tap: `ui dump compact` → see elements with IDs → `ui tap elementId: "e_a3f2"`. This eliminates the mandatory find step in many workflows.

**Priority:** **HIGH** — This simplifies the most common UI automation workflow from 3 calls (dump → find → tap) to 2 calls (dump → tap).

---

## Implementation Plan (Ordered by Impact)

### Phase 1: Element IDs (Highest Leverage)

**Estimated scope:** ~200 lines changed across 4 files

1. **Add `elementId()` hash function** — New utility in `src/parsers/ui-dump.ts`. Content-hash of text + resourceId + className + bounds region (quantized to ~50px grid to tolerate minor layout shifts).

2. **Add element cache to ServerContext** — Replace `lastFindResults: FindElement[]` with `elementCache: Map<string, CachedElement>` in `src/server.ts`. Cache entries include the element, the dumpId it came from, and a TTL.

3. **Update `ui find` response** — Add `id` field to every element in the response. Populate element cache on find.

4. **Update `ui dump` compact response** — Add `id` field to every element. Populate element cache on dump.

5. **Update `ui tap` to accept `elementId`** — Resolve ID from element cache. At tap time, optionally re-verify by dumping and checking that the ID still exists (configurable for speed vs. safety). Fall back to `elementIndex` for backwards compatibility during migration.

6. **Update `ui tap` error for stale IDs** — When elementId doesn't resolve, include compact current screen state in the error.

**Files changed:**
- `src/parsers/ui-dump.ts` — Add `elementId()` function
- `src/server.ts` — Replace `lastFindResults` with `elementCache`
- `src/tools/ui.ts` — Update `handleTap`, `handleCompactDump`
- `src/tools/ui-find.ts` — Update `formatElement`, `handleTextFind`, `handleSelectorFind`
- `src/types/schemas/ui-output.ts` — Add `id` to element schemas

### Phase 2: Post-Action State Feedback

**Estimated scope:** ~150 lines changed across 2 files

1. **Add post-action dump to `handleTap`** — After tapping, capture a compact dump. Compare with pre-action state (from element cache or a pre-tap dump). Return inline diff.

2. **Add post-action dump to `handleScroll`** — After scrolling, capture compact dump. Detect new elements (not in previous dump). Detect end-of-list (no new elements). Return inline.

3. **Add post-action dump to `handleInput`** — After text input, capture compact dump. Return new state inline.

4. **Make post-action feedback configurable** — Add `silent: true` option to skip post-action dump for performance-sensitive use cases (bulk tapping, rapid scrolling).

**Files changed:**
- `src/tools/ui.ts` — Update `handleTap`, `handleScroll`, `handleInput`
- `src/types/schemas/ui-output.ts` — Update output schemas

### Phase 3: State Diffing

**Estimated scope:** ~100 lines added

1. **Store full dump state in cache** — Already done (dump caches tree with dumpId).

2. **Add `since` parameter to dump** — When provided, compute diff between cached tree and current tree using element IDs. Return `{ added, removed, changed }`.

3. **Implement tree differ** — Compare two flattened element lists by ID. Detect added (new ID), removed (missing ID), and changed (same ID, different properties).

**Files changed:**
- `src/tools/ui.ts` — Update `handleDump`, add diff logic
- `src/parsers/ui-dump.ts` — Add `diffTrees()` function

### Phase 4: Logcat Structured Parsing

**Estimated scope:** ~80 lines added

1. **Add crash/exception parser to logcat** — Detect common patterns (FATAL EXCEPTION, stack traces, ANR).

2. **Return structured crash info in summary** — Include exception type, message, top frame.

3. **Prioritize errors in preview** — When errors exist, show error lines first instead of chronological first-20.

**Files changed:**
- `src/tools/adb-logcat.ts` — Update response format
- `src/parsers/adb-output.ts` — Add crash parsing

### Phase 5: Build Error Inlining

**Estimated scope:** ~30 lines added

1. **Parse first 3-5 errors from build output** — Extract file, line, message.
2. **Include in build response** — Add `topErrors` field.

**Files changed:**
- `src/tools/gradle-build.ts` — Update response format
- `src/parsers/gradle-output.ts` — Add error extraction

---

## Summary Table

| # | Tool/Area | Issue | Fix | Priority | Phase |
|---|-----------|-------|-----|----------|-------|
| 1 | `ui find` → `ui tap` | Positional indices as element references | Content-hashed element IDs | **HIGH** | 1 |
| 5 | `ui dump` compact | Elements lack IDs, no action path | Add IDs to compact elements | **HIGH** | 1 |
| A | `lastFindResults` | Server-side mutable state, silently overwritten | Replace with ID-keyed element cache | **HIGH** | 1 |
| 4 | `ui tap` errors | Stale ref → generic error, no recovery context | Include current screen state in error | **HIGH** | 1 |
| 2 | `ui tap/scroll/input` | No post-action state feedback | Auto-capture compact diff after action | **HIGH** | 2 |
| 3 | `ui dump` | Full tree re-dump, no diffing | `since` parameter, return delta | **MEDIUM** | 3 |
| B | dumpId threading | No state correlation across operations | Thread dumpId through all UI ops | **MEDIUM** | 3 |
| 6 | `adb-logcat` | Raw text preview, no crash parsing | Structured crash/error extraction | **MEDIUM** | 4 |
| C | Compact dump workflow | Dump → find → tap (3 calls) | Dump → tap via IDs (2 calls) | **HIGH** | 1 |
| 8 | `gradle-build` | Error count but no inline errors | Include top 3-5 errors inline | **LOW** | 5 |
| 7 | `adb-shell` | Freeform command, max reproduction burden | Smart hints for common errors | **LOW** | — |
| 9 | `gradle-get-details` | Cache miss message | Include TTL info in error | **LOW** | — |
| 10 | `adb-app list` | Package names without labels | Add app labels | **LOW** | — |
| 11 | `emulator-device` | Already clean | — | **LOW** | — |
| 12 | `adb-device` | Already clean | — | **LOW** | — |

---

## Design Principles Applied

1. **Stable addressability** → Element IDs (Phase 1). If the element hasn't changed, its ID hasn't changed. If it has changed, the ID resolves to a different element or fails cleanly.

2. **Minimal reproduction burden** → Element IDs eliminate the need for the model to reproduce text/coordinates to reference an element. Post-action state (Phase 2) eliminates the need to issue follow-up dumps.

3. **State diffing** → Phase 3 `since` parameter. Instead of re-parsing 200 nodes, the model sees "3 added, 1 removed, 1 changed."

4. **Clean failure over silent corruption** → Phase 1 stale ID errors include current screen state. The model can recover in one turn.

5. **Progressive disclosure consistency** → Already good for gradle/logcat. Phase 1 extends IDs to UI elements so compact dump → detailed dump follows the same summary → details-on-demand pattern.

---

## Backwards Compatibility

Phase 1 maintains backwards compatibility:
- `elementIndex` continues to work (deprecated but functional)
- `lastFindResults` continues to be populated alongside element cache
- New `id` fields are additive — no existing response fields are removed

After adoption is confirmed, Phase 1b removes `elementIndex` and `lastFindResults`.

---

## Risk Assessment

**ID collision risk:** SHA-256 truncated to 4 hex chars = 65,536 possible IDs. Typical screen has 10-50 interactive elements. Birthday paradox collision probability for 50 elements ≈ 1.9%. Mitigation: use 5 hex chars (1M possibilities, collision probability < 0.1%) or detect collisions and extend.

**Performance risk:** Post-action dump (Phase 2) adds one `uiautomator dump` call after every tap/scroll. This takes 200-500ms. Mitigation: make it configurable with `silent: true`, and consider using a lightweight "changed?" check before full dump.

**Tree comparison cost:** Diffing two flattened trees of 200 nodes is O(n) with an ID-keyed map. Negligible.
