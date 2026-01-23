# Screenshot Scaling Battle Test Plan

**Date**: 2026-01-23
**Branch**: `feature/screenshot-scaling`
**Status**: Ready for execution

## Goals

1. **Validate branch**: Are the screenshot scaling changes good enough to ship?
2. **Find tool boundaries**: Where does the tool cause agent failure?
3. **Learn agent design**: What makes an effective UI automation sub-agent?

## App Under Test

**Focus Strength** - Android workout tracking app with:
- 4 main tabs (Home, Progress, Calendar, Settings)
- Workout flow with dialogs and forms
- Various UI elements (buttons, toggles, cards, lists)

## Context Window Considerations

| Source | Approx. Tokens |
|--------|----------------|
| Screenshot (450x1000) | ~1,500-2,500 |
| UI dump (complex screen) | ~500-2,000 |
| find() with OCR fallback | Can explode to 100k+ |
| Tool call overhead | ~100-200 per call |

**Key insight**: The bottleneck isn't window size (200k), it's cumulative context burn and cognitive load for smaller models.

---

## Part 1: Variable Matrix

Test the same task with different agent configurations to isolate what matters.

### Task: Navigate to Settings and toggle "Timer Sound"

| Test ID | Model | Screenshot Budget | maxDimension | Strategy |
|---------|-------|-------------------|--------------|----------|
| M1 | haiku | 0 | N/A | dump-only |
| M2 | haiku | 1 | 1000 | screenshot + dump |
| M3 | haiku | 1 | 500 | screenshot + dump (smaller) |
| M4 | haiku | 3 | 1000 | screenshot-first |
| M5 | sonnet | 0 | N/A | dump-only |
| M6 | sonnet | 1 | 1000 | screenshot + dump |

**Metrics to collect:**
- Success (Y/N)
- Total tool calls
- Screenshots used
- Failure mode (if any)

---

## Part 2: Boundary Tests

Push the tool to find failure modes.

### B1: Find() Explosion Test
**Task**: Use `find({ text: "5" })` on workout screen (many matches expected)
**Expect**: Large response, potential context issues
**Learn**: How agents handle verbose tool responses

### B2: Rapid Screenshot Stress
**Task**: Take 5 consecutive screenshots with different maxDimension values
**Expect**: Context fills up, agent may lose track
**Learn**: Screenshot budget limits

### B3: Ambiguous Tap Target
**Task**: Tap "5" on the sets/reps dialog (multiple "5"s visible)
**Expect**: May tap wrong one
**Learn**: How coordinate precision handles ambiguity

### B4: Long Workflow
**Task**: Full workout flow (start → modify → exercise → finish)
**Expect**: 8-10 interactions, high context usage
**Learn**: Maximum practical workflow length

---

## Part 3: Feature Validation

Confirm the scaling implementation works correctly.

### F1: Coordinate Roundtrip
**Task**: Take screenshot, get element bounds from dump, tap element, verify action worked
**Validates**: image-space → device-space conversion

### F2: Scale Factor Consistency
**Task**: Take screenshots with different maxDimension, verify scaleFactor updates correctly
**Validates**: Scaling state management

### F3: Raw Mode
**Task**: Take screenshot with `raw: true`, verify no scaling and warning present
**Validates**: Raw mode bypass

### F4: Inline Mode Fix
**Task**: Take scaled screenshot, then inline screenshot, verify dump returns unscaled bounds
**Validates**: Greptile fix - inline clears scaling state

---

## Sub-Agent Prompt Templates

### Matrix Tests (M1-M6)

```
You are testing the replicant-mcp UI automation tool.

TASK: Navigate to Settings tab and toggle the "Timer Sound" switch.

CONSTRAINTS:
- Screenshot budget: {N} (0 = dump-only, no screenshots allowed)
- If using screenshots, use maxDimension: {D}
- Strategy: {strategy description}

AVAILABLE TOOLS:
- ui { operation: "dump" } → accessibility tree (bounds in image-space if screenshot taken)
- ui { operation: "screenshot", maxDimension: N } → scaled screenshot
- ui { operation: "find", selector: {...} } → find elements (AVOID broad text searches)
- ui { operation: "tap", x: N, y: N } → tap at image-space coordinates

APPROACH:
1. Get device with adb-device list
2. Use dump() to understand current screen
3. Find Settings tab and tap it
4. Find Timer Sound toggle and tap it
5. Verify toggle state changed

REPORT FORMAT (end your response with this):
---
RESULT: SUCCESS | FAILURE | PARTIAL
TOOL_CALLS: [count]
SCREENSHOTS_USED: [count]
FAILURE_MODE: [none | context_overflow | wrong_target | stuck | tool_error | other]
NOTES: [observations about what worked/didn't]
---
```

### Boundary Tests (B1-B4)

```
You are testing boundaries of the replicant-mcp UI automation tool.

TASK: {specific task}

OBJECTIVE: Find where the tool fails, not just succeed.
- Try the operation
- Note response sizes and any truncation
- If you hit a wall, describe it clearly
- Don't retry forever - 3 attempts max then report

REPORT FORMAT:
---
BOUNDARY_HIT: YES | NO
DESCRIPTION: [what happened]
RESPONSE_SIZE: [note any large responses]
RECOMMENDATION: [how tool/agent could handle this better]
---
```

### Feature Validation (F1-F4)

```
You are validating a specific feature of replicant-mcp screenshot scaling.

FEATURE: {feature name}
EXPECTED BEHAVIOR: {description}

TEST STEPS:
{specific steps}

REPORT FORMAT:
---
FEATURE: {name}
VALIDATED: YES | NO
ACTUAL_BEHAVIOR: [what happened]
ISSUE: [if NO, describe the problem]
---
```

---

## Execution Plan

### Phase 1: Matrix Tests (Parallel)
Run M1-M6 in parallel with different configurations.
Compare results to identify optimal agent setup.

### Phase 2: Boundary Tests (Sequential)
Run B1-B4 one at a time to avoid interference.
These intentionally push limits.

### Phase 3: Feature Validation (Parallel)
Run F1-F4 in parallel.
These should all pass if implementation is correct.

### Phase 4: Compile Report
Aggregate results into final report.

---

## Final Report Template

```markdown
# Screenshot Scaling Battle Test Report

**Date**: YYYY-MM-DD
**Branch**: feature/screenshot-scaling

## Summary
- Tests run: X
- Passed: Y
- Failed: Z
- Partial: W

## Branch Verdict: SHIP | NEEDS_WORK | BLOCK

### Rationale
[Why this verdict]

## Matrix Test Results

| Test | Model | Strategy | Success | Tool Calls | Failure Mode |
|------|-------|----------|---------|------------|--------------|
| M1 | haiku | dump-only | | | |
| M2 | haiku | ss+dump | | | |
| M3 | haiku | ss+dump (500) | | | |
| M4 | haiku | ss-first | | | |
| M5 | sonnet | dump-only | | | |
| M6 | sonnet | ss+dump | | | |

### Best Configuration
[Which combo worked best and why]

## Boundary Test Results

| Test | Boundary Hit | Description |
|------|--------------|-------------|
| B1 | | |
| B2 | | |
| B3 | | |
| B4 | | |

### Tool Limitations Discovered
- [List]

## Feature Validation Results

| Feature | Validated | Issue |
|---------|-----------|-------|
| F1: Coordinate Roundtrip | | |
| F2: Scale Factor Consistency | | |
| F3: Raw Mode | | |
| F4: Inline Mode Fix | | |

## Learnings: Effective UI Automation Agents

### What Works
- [bullets]

### What Doesn't Work
- [bullets]

### Recommendations for Agent Design
- [bullets]

## Recommended Tool Improvements
1. [Prioritized list]
```
