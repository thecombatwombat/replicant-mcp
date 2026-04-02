---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/tools/rtfm.ts
  - src/tools/cache.ts
  - src/tools/adb-device.ts
  - src/tools/adb-app.ts
  - src/tools/adb-logcat.ts
  - src/tools/adb-shell.ts
  - src/tools/emulator-device.ts
  - src/tools/gradle-build.ts
  - src/tools/gradle-test.ts
  - src/tools/gradle-list.ts
  - src/tools/gradle-get-details.ts
  - src/tools/ui-query.ts
  - src/tools/ui-action.ts
  - src/tools/ui-capture.ts
  - package.json
  - tests/tools/token-budget.test.ts
  - tests/tools/tool-annotations.test.ts
autonomous: false
requirements: []

must_haves:
  truths:
    - "All 14 tool definitions include MCP annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)"
    - "package.json files array includes icon.png for npm publishing"
    - "Token budget test passes with updated ceiling accounting for annotation bytes"
    - "All existing tests continue to pass"
  artifacts:
    - path: "src/tools/rtfm.ts"
      provides: "annotations on rtfmToolDefinition"
      contains: "annotations"
    - path: "src/tools/ui-action.ts"
      provides: "annotations on uiActionToolDefinition"
      contains: "destructiveHint: true"
    - path: "tests/tools/tool-annotations.test.ts"
      provides: "test ensuring all tools have annotations"
      min_lines: 15
    - path: "package.json"
      provides: "icon.png in files array"
      contains: "icon.png"
  key_links:
    - from: "src/tools/*.ts"
      to: "src/server.ts"
      via: "toolDefinitions array passes annotations through to ListToolsRequestSchema handler"
      pattern: "annotations"
---

<objective>
Address Anthropic MCP Registry feedback for replicant-mcp directory listing: add MCP tool annotations to all 14 tools and prepare package.json for icon.png inclusion.

Purpose: Required for Anthropic MCP Directory listing approval (GitHub issue #106).
Output: All tool definitions annotated, package.json updated, icon placeholder noted.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/server.ts (lines 89-104 — toolDefinitions array, lines 184-186 — ListTools handler)
@tests/tools/token-budget.test.ts (TOKEN_CEILING at 1700 — will need raising)

<interfaces>
<!-- Tool definition pattern — every file in src/tools/*.ts follows this: -->
From src/tools/rtfm.ts:
```typescript
export const rtfmToolDefinition = {
  name: "rtfm",
  description: "Get documentation. Pass category or tool name.",
  inputSchema: {
    type: "object",
    properties: { ... },
  },
};
```

<!-- Target format — add annotations field to each definition: -->
```typescript
export const rtfmToolDefinition = {
  name: "rtfm",
  description: "Get documentation. Pass category or tool name.",
  inputSchema: { ... },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
```

<!-- Server passes definitions through unchanged (no transformation needed): -->
From src/server.ts:
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add MCP annotations to all 14 tool definitions and update token budget</name>
  <files>
    src/tools/rtfm.ts
    src/tools/cache.ts
    src/tools/adb-device.ts
    src/tools/adb-app.ts
    src/tools/adb-logcat.ts
    src/tools/adb-shell.ts
    src/tools/emulator-device.ts
    src/tools/gradle-build.ts
    src/tools/gradle-test.ts
    src/tools/gradle-list.ts
    src/tools/gradle-get-details.ts
    src/tools/ui-query.ts
    src/tools/ui-action.ts
    src/tools/ui-capture.ts
    tests/tools/tool-annotations.test.ts
    tests/tools/token-budget.test.ts
  </files>
  <behavior>
    - Test: every exported tool definition has an `annotations` object
    - Test: every annotations object has all four boolean fields (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
    - Test: read-only tools (rtfm, adb-logcat, gradle-list, gradle-get-details, ui-query, ui-capture) have readOnlyHint: true and destructiveHint: false
    - Test: destructive tools (ui-action, adb-shell) have destructiveHint: true and readOnlyHint: false
    - Test: token budget test still passes (ceiling raised to accommodate annotation bytes)
  </behavior>
  <action>
    1. Create `tests/tools/tool-annotations.test.ts` — write tests FIRST:
       - Import all 14 tool definitions from `../../src/tools/index.js`
       - Test that each definition has an `annotations` property that is an object
       - Test that each annotations object contains exactly `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` as booleans
       - Test specific values for known categories:
         - Pure read-only tools: rtfm, adb-logcat, gradle-list, gradle-get-details, ui-query, ui-capture -> readOnlyHint: true, destructiveHint: false
         - Pure destructive tools: ui-action, adb-shell -> destructiveHint: true, readOnlyHint: false
       - Run tests — they MUST fail (RED)

    2. Add `annotations` object to each tool definition export. Use conservative annotations for multi-operation tools (if ANY operation is destructive, destructiveHint: true). Specific annotations per tool:

       | Tool | readOnly | destructive | idempotent | openWorld |
       |------|----------|-------------|------------|-----------|
       | rtfm | true | false | true | false |
       | cache | false | true | false | false |
       | adb-device | false | true | false | false |
       | adb-app | false | true | false | false |
       | adb-logcat | true | false | true | false |
       | adb-shell | false | true | false | true |
       | emulator-device | false | true | false | false |
       | gradle-build | false | false | false | false |
       | gradle-test | false | false | false | false |
       | gradle-list | true | false | true | false |
       | gradle-get-details | true | false | true | false |
       | ui-query | true | false | true | false |
       | ui-action | false | true | false | false |
       | ui-capture | true | false | true | false |

       Notes on annotation choices:
       - cache: has clear/set-config operations -> destructiveHint: true, not idempotent (clear changes state)
       - adb-device: has select/wait operations that mutate state -> destructiveHint: true
       - adb-app: install/uninstall/launch/stop/clear-data -> destructiveHint: true
       - adb-shell: arbitrary commands, unknown scope -> openWorldHint: true, destructiveHint: true
       - emulator-device: create/kill/wipe -> destructiveHint: true
       - gradle-build: runs builds (produces artifacts, not destructive but not read-only) -> all false except openWorld: false
       - gradle-test: runs tests, saveBaseline modifies state -> not destructive per se but not read-only either

    3. Run tests — they MUST pass (GREEN)

    4. Update `tests/tools/token-budget.test.ts`: the TOKEN_CEILING constant (currently 1700) needs raising to accommodate annotation fields across 14 tools. Each annotation adds roughly ~80 chars (~20 tokens) per tool, so ~280 tokens total. Set new ceiling to 2000 to keep it tight but accommodating. Run the token budget test — if actual measured value is higher, adjust ceiling to measured + ~25 tokens headroom.

    5. Run full test suite: `npm run test -- --run` to confirm nothing breaks.
  </action>
  <verify>
    <automated>cd /Users/architjoshi/code/claude/replicant-mcp && npm run test -- --run</automated>
  </verify>
  <done>All 14 tool definitions have annotations with correct hint values. New annotation test passes. Token budget test passes with updated ceiling. All existing tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Add icon.png to package.json files array</name>
  <files>package.json</files>
  <action>
    In package.json, add `"icon.png"` to the `"files"` array (currently contains: `"dist/"`, `"docs/rtfm/"`, `"docs/contracts/"`, `"README.md"`, `"LICENSE"`). Add it as the last entry.

    This ensures that when `icon.png` is placed in the repo root, it will be included in the npm package. The actual icon file creation is a design task handled separately (checkpoint below).
  </action>
  <verify>
    <automated>cd /Users/architjoshi/code/claude/replicant-mcp && node -e "const pkg = require('./package.json'); if (!pkg.files.includes('icon.png')) { process.exit(1); } console.log('icon.png found in files array');"</automated>
  </verify>
  <done>package.json files array includes "icon.png" entry.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <what-built>Tool annotations added to all 14 tools and package.json prepared for icon. The codebase is ready except for the actual icon.png file.</what-built>
  <how-to-verify>
    You need to provide an `icon.png` file (recommended 512x512 pixels) in the repository root.
    Options:
    1. Design one yourself (Android robot + MCP concept, simple and clean)
    2. Use an AI image generator to create one
    3. Commission or find a suitable open-source icon

    Once placed at repo root, verify: `ls -la icon.png` shows the file exists and `file icon.png` confirms it's a PNG.
  </how-to-verify>
  <resume-signal>Say "icon added" once icon.png is in the repo root, or "skip icon" to proceed without it for now.</resume-signal>
</task>

</tasks>

<verification>
- `npm run test -- --run` passes (all existing + new annotation tests)
- `npm run build` succeeds
- All 14 tool definitions in src/tools/*.ts contain `annotations` object
- package.json `files` array includes `icon.png`
</verification>

<success_criteria>
- All 14 MCP tool definitions have annotations with readOnlyHint, destructiveHint, idempotentHint, openWorldHint
- Annotations use conservative values for multi-operation tools (most restrictive operation wins)
- Token budget test updated and passing
- package.json ready for icon.png inclusion
- PR can be created addressing GitHub issue #106 feedback
</success_criteria>

<output>
After completion, create `.planning/quick/260402-rlp-address-anthropic-mcp-registry-feedback-/260402-rlp-SUMMARY.md`
</output>
