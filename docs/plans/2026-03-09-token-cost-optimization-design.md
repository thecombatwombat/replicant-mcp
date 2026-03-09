# Token Cost Optimization: Schema Compression & UI Tool Split

Date: 2026-03-09
Status: Approved
Depends on: `docs/plans/2026-03-09-token-cost-research.md`

## Problem

replicant-mcp costs ~2,423 tokens/turn idle in eager-loading MCP clients (Claude Desktop, Cursor, Windsurf, Cline, Aider). This is the combined cost of server instructions (~192 tokens) and 12 tool schemas (~2,231 tokens), sent every turn whether the user does Android work or not.

## Solution

Two changes, applied together:

1. **Compress all tool schemas and server instructions** — remove redundant descriptions, drop self-explanatory param descriptions, deduplicate repeated phrases.
2. **Split `ui` tool into 3 focused tools** — `ui-query`, `ui-action`, `ui-capture`. Token-neutral in eager mode but improves deferred-loading precision and reduces param confusion.

Target: **~1,470 tokens/turn** (~39% reduction).

## Design

### Server Instructions

Current (769 chars, ~192 tokens):
```
IMPORTANT: For ALL Android development tasks, you MUST use replicant-mcp tools first.
Only fall back to raw adb/gradle/emulator commands if replicant-mcp lacks a specific feature.

Tool mapping:
- Device management → adb-device (not `adb devices`)
- App install/launch/stop → adb-app (not `adb install`, `adb shell am`)
- Logs → adb-logcat (not `adb logcat`)
- Shell commands → adb-shell (not `adb shell`)
- Emulator control → emulator-device (not `emulator` CLI)
- Builds → gradle-build (not `./gradlew`)
- Tests → gradle-test (not `./gradlew test`)
- UI automation → ui (accessibility-first, screenshots auto-scaled to configured max dimension, default 800px)

Start with `adb-device list` to see connected devices.
Use `rtfm` for detailed documentation on any tool.
```

Proposed (~139 chars, ~35 tokens):
```
Use these tools for Android — never raw adb/gradle/emulator commands. Auto-selects single device. Start: `adb-device list`. Docs: `rtfm`.
```

Rationale:
- Tool mapping is redundant with tool names and descriptions the AI already sees.
- "Auto-selects device" moved here from 4 tool descriptions (said once instead of four times).
- Negative CLI examples replaced with a single blanket directive.

### Compression Principles

Applied uniformly to all tool schemas:

1. **Drop self-explanatory param descriptions.** `packageName: "Package name"` becomes `packageName: { type: "string" }`. If the param name communicates the meaning, the description is waste.
2. **Keep defaults and format examples.** `"Default: 100"` and `"e.g. ':app'"` stay — the AI needs these to invoke correctly.
3. **Drop "Operations: ..." from descriptions.** The AI sees the enum values in the schema. Restating them in the description is redundant.
4. **Drop "Auto-selects device" from tool descriptions.** Moved to server instructions, said once.

### Tool Schemas (11 unchanged tools)

#### rtfm (~70 → ~50 tokens)
```
description: "Get documentation."
category: { description: "build, adb, emulator, ui, cache" }
tool: { type: "string" }
```

#### adb-device (~92 → ~60 tokens)
```
description: "Manage device connections."
deviceId: { type: "string" }
```

#### gradle-list (~81 → ~60 tokens)
```
description: "List project modules, variants, or tasks."
module: { description: "e.g. ':app'" }
```

#### gradle-build (~99 → ~70 tokens)
```
description: "Build. Returns summary with buildId."
module: { description: "e.g. ':app'" }
flavor: { type: "string" }
```

#### cache (~124 → ~95 tokens)
```
description: "Manage the cache."
key: { description: "Key to clear" }
config: { ... }  // sub-props already minimal
```

#### emulator-device (~165 → ~105 tokens)
```
description: "Manage emulators."
avdName: { type: "string" }
device: { description: "e.g. 'pixel_7'" }
systemImage: { type: "string" }
snapshotName: { type: "string" }
emulatorId: { type: "string" }
```

#### gradle-test (~166 → ~120 tokens)
```
description: "Run tests. Returns summary with testId. With baseline, auto-detects regressions."
module: { description: "e.g. ':app'" }
filter: { description: "e.g. '*LoginTest*'" }
taskName: { description: "For baseline ops. Defaults to operation." }
```

#### adb-logcat (~167 → ~110 tokens)
```
description: "Read device logs. Returns summary with logId."
lines: { description: "Default: 100" }
package: { type: "string" }
tags: { type: "array", items: { type: "string" } }
level: { enum: ["verbose", "debug", "info", "warn", "error"] }
rawFilter: { description: "Raw logcat filter" }
since: { description: "adb logcat -T format, e.g. '01-20 15:30:00.000'" }
```

#### adb-shell (~176 → ~120 tokens)
```
description: "Execute shell commands. Dangerous commands blocked."
command: { type: "string" }
timeout: { description: "ms (default: 30000, max: 120000)" }
maxChars: { description: "Truncate output to N chars" }
summaryOnly: { description: "Compact preview only" }
previewChars: { description: "Preview length (default: 200)" }
```

#### adb-app (~204 → ~120 tokens)
```
description: "Manage apps."
apkPath: { type: "string" }
packageName: { type: "string" }
limit: { description: "For list. Default: 20, max: 100" }
filter: { description: "For list. Case-insensitive." }
offset: { description: "For list. Skip first N." }
```

#### gradle-get-details (~182 → ~110 tokens)
```
description: "Fetch full output by build/test ID."
id: { type: "string" }
detailType: { enum: ["logs", "errors", "tasks", "all"] }
maxChars: { description: "Truncate to N chars" }
summaryOnly: { description: "Compact summary (ignored for errors)" }
previewChars: { description: "Preview length (default: 400)" }
```

### UI Tool Split (1 tool → 3)

The current `ui` tool has 8 operations and 18 parameters. Most params apply to only 1-2 operations. Splitting into 3 focused tools:

#### ui-query (~180 tokens)
Operations: `dump`, `find`, `accessibility-check`
```
description: "Query app UI via accessibility tree."
operation: { enum: ["dump", "find", "accessibility-check"] }
selector: {
  properties: { resourceId, text, textContains, className,
    nearestTo: { description: "Spatial proximity search" } },
  description: "For find"
}
compact: { description: "Dump: flat list (default: true)" }
limit: { description: "Dump: max elements (default: 20)" }
offset: { description: "Dump: skip first N" }
maxTier: { description: "Find: max fallback tier. 3 = stop before visual." }
gridCell: { description: "Tier 5 cell (1-24)" }
gridPosition: { description: "1=TL 2=TR 3=C 4=BL 5=BR" }
debug: { type: "boolean" }
```

#### ui-action (~150 tokens)
Operations: `tap`, `input`, `scroll`
```
description: "Tap, type, or scroll in the app."
operation: { enum: ["tap", "input", "scroll"] }
selector: {
  properties: { resourceId, text, textContains, className,
    nearestTo: { description: "Spatial proximity search" } },
  description: "For find-then-act"
}
elementIndex: { description: "Index from last find" }
x: { type: "number" }
y: { type: "number" }
deviceSpace: { description: "x/y as device coords (skip scaling)" }
text: { description: "For input op" }
direction: { enum: ["up", "down", "left", "right"] }
amount: { description: "Scroll fraction (default: 0.5)" }
```

#### ui-capture (~100 tokens)
Operations: `screenshot`, `visual-snapshot`
```
description: "Take screenshots or visual snapshots."
operation: { enum: ["screenshot", "visual-snapshot"] }
localPath: { type: "string" }
inline: { description: "Return base64 (default: false)" }
maxDimension: { description: "Max px (default: 800)" }
raw: { description: "Full resolution, may exceed API limits" }
```

### Deferred Loading Benefit

In Claude Code with deferred loading active, the split means:
- "Take a screenshot" → loads only `ui-capture` (~100 tokens) instead of full `ui` (~450 tokens)
- "Tap a button" → loads only `ui-action` (~150 tokens)
- "Find an element" → loads only `ui-query` (~180 tokens)

Per-search token cost reduced 2.5-4.5x.

## Token Budget Summary

| Component | Current | Proposed | Saved |
|-----------|---------|----------|-------|
| Server instructions | ~192 | ~35 | ~157 |
| rtfm | ~70 | ~50 | ~20 |
| adb-device | ~92 | ~60 | ~32 |
| gradle-list | ~81 | ~60 | ~21 |
| gradle-build | ~99 | ~70 | ~29 |
| cache | ~124 | ~95 | ~29 |
| emulator-device | ~165 | ~105 | ~60 |
| gradle-test | ~166 | ~120 | ~46 |
| adb-logcat | ~167 | ~110 | ~57 |
| adb-shell | ~176 | ~120 | ~56 |
| adb-app | ~204 | ~120 | ~84 |
| gradle-get-details | ~182 | ~110 | ~72 |
| ui (→ 3 tools) | ~706 | ~430 | ~276 |
| **Total** | **~2,423** | **~1,485** | **~938** |

**39% reduction** across all eager-loading clients. Per-turn idle cost drops from ~2,423 to ~1,485 tokens.

Over a 50-turn session: **~125,000 → ~74,250 tokens** (~50,750 saved).

## Implementation Notes

### Breaking Changes

The `ui` tool split is a breaking change for any automation that calls `ui` by name. Mitigation options:
- Keep `ui` as a deprecated alias that dispatches to the new tools internally.
- Or remove it cleanly since this is a minor version bump and tool names are not a public API guarantee for MCP.

### What NOT to Change

- Zod validation schemas — these stay as-is (they validate input, not cost tokens).
- Tool handler logic — no behavioral changes.
- Progressive disclosure / caching — already optimized, orthogonal to this work.

### Testing

- Verify all tools still register correctly via `tools/list`.
- Verify compressed descriptions don't break AI tool selection (manual testing in Claude Desktop + Claude Code).
- Run existing integration tests to confirm no behavioral regressions.
- Measure actual token counts post-change (compare `tools/list` response size).
