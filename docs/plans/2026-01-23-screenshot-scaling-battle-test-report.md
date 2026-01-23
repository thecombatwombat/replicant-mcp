# Screenshot Scaling Battle Test Report

**Date**: 2026-01-23
**Branch**: feature/screenshot-scaling

## Summary
- Tests run: 11
- Passed: 10
- Failed: 0
- Partial: 1

## Branch Verdict: SHIP ✅

### Rationale
All critical functionality validated. Screenshot scaling works correctly across all tested scenarios:
- Coordinate conversion (image-space → device-space) is accurate
- Scale factors update consistently
- Raw mode and inline mode work as documented
- No regressions found

The one partial result (B4) was due to tool call limits, not a bug in the implementation.

---

## Matrix Test Results

| Test | Model | Strategy | Success | Tool Calls | Screenshots | Failure Mode |
|------|-------|----------|---------|------------|-------------|--------------|
| M2 | haiku | ss+dump 1000 | ✅ | 6 | 2 | none |
| M3 | haiku | ss+dump 500 | ✅ | 7 | 1 | none |
| M4 | haiku | ss-first | ✅ | 7 | 3 | none |
| M6 | sonnet | ss+dump 1000 | ✅ | 6 | 1 | none |

### Best Configuration
**Haiku with screenshot+dump at maxDimension 1000** - Best balance of accuracy (6-7 tool calls) and efficiency. Sonnet performed similarly but at higher cost. The 500px scaling worked but may reduce visual clarity for complex UIs.

---

## Boundary Test Results

| Test | Boundary Tested | Result | Description |
|------|-----------------|--------|-------------|
| B2 | Screenshot stress | ✅ PASS | Scale factors 1.6x-9.6x all work correctly |
| B3 | Ambiguous targets | ✅ PASS | Coordinate precision reliably distinguishes nearby elements |
| B4 | Long workflow | ⚠️ PARTIAL | 6/7 steps in 20 tool calls, hit limit not bug |

### Tool Limitations Discovered
- Long workflows (6+ distinct interactions) may require 20+ tool calls
- No scaling-related limits found - all scale factors worked correctly

---

## Feature Validation Results

| Feature | Validated | Issue |
|---------|-----------|-------|
| F1: Coordinate Roundtrip | ✅ YES | Bounds from dump correctly map to tap targets |
| F2: Scale Factor Consistency | ✅ YES | Formula verified: scaleFactor = deviceHeight / imageHeight |
| F3: Raw Mode | ✅ YES | Bypasses scaling, warning present, full resolution |
| F4: Inline Mode Fix | ✅ YES | Greptile fix confirmed - inline clears scaling state |

---

## Learnings: Effective UI Automation Agents

### What Works
- Screenshot + dump combo provides both visual context and precise coordinates
- Haiku model is sufficient for UI automation tasks (6-7 tool calls typical)
- maxDimension 1000 provides good balance of quality and token efficiency
- Explicit device assignment eliminates race conditions
- Hard limits (15-20 tool calls) provide good guardrails

### What Doesn't Work
- Dump-only mode fails for Compose UI (switches lack text labels)
- Broad find() queries with short text cause response explosion
- Parallel execution on same device causes race conditions
- Very long workflows (7+ steps) may hit tool call limits

### Recommendations for Agent Design
1. Always include explicit deviceId in prompts
2. Bake app navigation knowledge into prompts (tab positions, etc.)
3. Set hard tool call limits (15 for simple tasks, 20 for complex)
4. Require screenshots for Compose UI interactions
5. Use dump + tap by coordinates, avoid find() with short strings
6. Reset app state between tests (force-stop + launch)

---

## Recommended Tool Improvements

1. **P1: find() response size limit** - Visual fallback can produce 140k+ character responses. Add configurable limit.
2. **P2: Compose UI switch labels** - Consider OCR fallback when accessibility tree lacks labels
3. **P3: Long workflow support** - Consider stateful agent with checkpoint/resume capability

---

## Raw Data

### Scaling Behavior
| maxDimension | Image Size | Scale Factor |
|--------------|------------|--------------|
| 1500 | 675×1500 | 1.6 |
| 1000 | 450×1000 | 2.4 |
| 750 | 338×750 | 3.2 |
| 500 | 225×500 | 4.8 |
| 250 | 113×250 | 9.6 |

Device resolution: 1080×2400

### Test Execution
- Phase 1 (Matrix): emulator-5554, sequential with app reset
- Phase 2 (Boundary): emulator-5556, sequential
- Phase 3 (Features): emulator-5558, sequential

Total execution: ~15 minutes autonomous (no user intervention required)
