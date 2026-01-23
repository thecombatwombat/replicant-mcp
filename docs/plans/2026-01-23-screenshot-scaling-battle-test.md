# Screenshot Scaling Battle Test Plan

**Date**: 2026-01-23
**Branch**: `feature/screenshot-scaling`
**Status**: Ready for execution (v2 - post-learning revision)

## Goals

1. **Validate branch**: Are the screenshot scaling changes good enough to ship?
2. **Find tool boundaries**: Where does the tool cause agent failure?
3. **Learn agent design**: What makes an effective UI automation sub-agent?

## Learnings from v1 Parallel Attempt

| Issue | Root Cause | Fix Applied |
|-------|------------|-------------|
| Race conditions | All 6 agents competed for same device | Sequential execution + dedicated devices |
| Compose UI accessibility | Switches have no text labels in dump | Removed dump-only tests, require screenshots |
| find() explosion | Visual fallback produces 140k+ chars | Avoid broad text searches, use dump + tap |
| App state drift | No reset between tests | Force-stop + relaunch protocol |
| Permission issues | Sub-agents couldn't access MCP | Added `mcp__replicant__*` wildcard permission |

## App Under Test

**Focus Strength** - Android Compose workout tracking app with:
- 4 main tabs (Home, Progress, Calendar, Settings)
- Workout flow with dialogs and forms
- Various UI elements (buttons, toggles, cards, lists)
- **Critical**: Compose UI - switches don't expose text labels in accessibility tree

## Available Devices

| Device ID | Assignment |
|-----------|------------|
| emulator-5554 | Matrix tests (sequential) |
| emulator-5556 | Boundary tests |
| emulator-5558 | Feature validation |

---

## Part 1: Matrix Tests (Sequential on emulator-5554)

Test the same task with different agent configurations.

### Task: Navigate to Settings and toggle "Timer Sound"

| Test ID | Model | Screenshot Budget | maxDimension | Strategy |
|---------|-------|-------------------|--------------|----------|
| M2 | haiku | 1 | 1000 | screenshot + dump |
| M3 | haiku | 1 | 500 | screenshot + dump (smaller) |
| M4 | haiku | 3 | 1000 | screenshot-first |
| M6 | sonnet | 1 | 1000 | screenshot + dump |

**Removed**: M1 and M5 (dump-only) - Compose UI doesn't expose switch labels

**Metrics:**
- Success (Y/N)
- Total tool calls
- Screenshots used
- Failure mode (if any)

---

## Part 2: Boundary Tests (on emulator-5556)

Push the tool to find failure modes.

### B2: Rapid Screenshot Stress
**Task**: Take 5 consecutive screenshots with different maxDimension values
**Expect**: Context fills up, agent may lose track
**Learn**: Screenshot budget limits

### B3: Ambiguous Tap Target
**Task**: Navigate to workout, tap "5" for sets (multiple "5"s visible)
**Expect**: May tap wrong one
**Learn**: How coordinate precision handles ambiguity

### B4: Long Workflow
**Task**: Full workout flow (start → modify → exercise → finish)
**Expect**: 8-10 interactions, high context usage
**Learn**: Maximum practical workflow length

**Removed**: B1 (find explosion) - Known issue, will track as future improvement

---

## Part 3: Feature Validation (on emulator-5558)

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

## Sub-Agent Design Principles

Based on v1 failures:

1. **Explicit device assignment** - Each agent gets `deviceId` in prompt
2. **Self-contained app knowledge** - Bake in navigation hints (Settings is 4th tab)
3. **Hard limits** - Max 15 tool calls, stop and report if stuck
4. **No broad find()** - Use dump + tap, never `find({ text: "..." })` with short strings
5. **Screenshot-first for Compose** - Always take screenshot before interacting with switches

---

## Sub-Agent Prompt Template

```
You are testing the replicant-mcp UI automation tool.

DEVICE: {deviceId} (use this for ALL tool calls)
TASK: {task description}

CONSTRAINTS:
- Screenshot budget: {N}
- If using screenshots, use maxDimension: {D}
- MAX TOOL CALLS: 15 (stop and report if you hit this)

APP KNOWLEDGE (Focus Strength):
- Bottom nav has 4 tabs: Home (1st), Progress (2nd), Calendar (3rd), Settings (4th)
- Settings tab is rightmost, look for gear icon or "Settings" text
- Timer Sound toggle is in Settings, scroll if needed
- Compose UI: switches don't have text labels in accessibility dump
- NEVER use find() with short text like "5" - use dump + tap by index

TOOLS (always include deviceId):
- mcp__replicant__adb-device { operation: "list" } - verify device
- mcp__replicant__ui { deviceId, operation: "dump" } - accessibility tree
- mcp__replicant__ui { deviceId, operation: "screenshot", maxDimension: N } - scaled screenshot
- mcp__replicant__ui { deviceId, operation: "tap", x: N, y: N } - tap at image-space coordinates

APPROACH:
1. Verify device with adb-device list
2. Take screenshot to see current state
3. Use dump to get element bounds (bounds are in image-space after screenshot)
4. Find target element and tap using its bounds
5. Verify action worked

STUCK DETECTION:
- If same screen appears 3 times, you're stuck - report and stop
- If tool returns error twice, report and stop
- If you hit 15 tool calls, report and stop

REPORT FORMAT (end your response with this):
---
RESULT: SUCCESS | FAILURE | PARTIAL
TOOL_CALLS: [count]
SCREENSHOTS_USED: [count]
FAILURE_MODE: [none | context_overflow | wrong_target | stuck | tool_error | limit_hit | other]
NOTES: [observations about what worked/didn't]
---
```

---

## Execution Plan

### Phase 0: App Reset Protocol
Between each test on the same device:
```bash
adb -s {deviceId} shell am force-stop com.urjit.focus_strength
adb -s {deviceId} shell monkey -p com.urjit.focus_strength -c android.intent.category.LAUNCHER 1
```

### Phase 1: Matrix Tests (Sequential)
Run M2, M3, M4, M6 on emulator-5554.
Reset app between each test.

### Phase 2: Boundary Tests (Sequential)
Run B2, B3, B4 on emulator-5556.

### Phase 3: Feature Validation (Parallel)
Run F1, F2, F3, F4 on emulator-5558.
These can run in parallel since they're independent.

### Phase 4: Compile Report
Aggregate results into final report.

---

## Execution Command

After Claude Code restart, run:
```
Execute the screenshot scaling battle test plan at docs/plans/2026-01-23-screenshot-scaling-battle-test.md

Run all phases sequentially. Between each matrix test, reset the app using force-stop and launch.

Report results in the Final Report Template format at the end.
```

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
| M2 | haiku | ss+dump 1000 | | | |
| M3 | haiku | ss+dump 500 | | | |
| M4 | haiku | ss-first | | | |
| M6 | sonnet | ss+dump 1000 | | | |

### Best Configuration
[Which combo worked best and why]

## Boundary Test Results

| Test | Boundary Hit | Description |
|------|--------------|-------------|
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
