# Long Workflow Strategies Design

**Date**: 2026-01-23
**Goal**: Enable 50+ step UI automation workflows

## Problem Statement

Baseline UI automation uses ~3.3 tool calls per step (screenshot + dump + tap + verify).
At this rate, 50 steps = 165 tool calls, which exceeds practical limits.

**Target**: <1.5 calls/step to enable 50+ steps in ~75 tool calls.

---

## Experimental Results

| Strategy | Tool Calls | Steps | Calls/Step | Notes |
|----------|------------|-------|------------|-------|
| B: Lean (dump+tap) | 40 | 18 | 2.22 | No screenshots, no verification |
| C: Trust (memory) | 30 | 30 | **1.0** | Tap from memory, verify periodically |
| D: Chunked (batch) | 23 | 10 | 2.3 | Setup overhead, efficient batching |

**Winner: Strategy C (Trust Mode)** - 1.0 calls/step

---

## Strategy C: Trust Mode (Recommended)

### Core Principles

1. **Learn once, execute many**: Do initial dump to learn UI layout, then execute multiple taps from memory
2. **Periodic verification**: Only dump every 5-10 steps to detect drift
3. **Coordinate memory**: Remember key positions (tabs, buttons, controls)
4. **Trust taps**: Don't verify every action - only check at checkpoints

### Implementation Pattern

```
Phase 1: LEARN (2-3 calls)
- Take screenshot to see UI
- Dump to get precise coordinates
- Memorize: tabs, primary actions, form controls

Phase 2: EXECUTE (N calls for N taps)
- Tap from memorized coordinates
- NO dump between taps
- Trust that taps succeed

Phase 3: CHECKPOINT (1 call every 5-10 steps)
- Dump to verify current state
- Detect drift (wrong screen, dialog appeared)
- Adjust coordinates if UI changed
- Continue or recover

Phase 4: VERIFY (1-2 calls)
- Final dump to confirm outcome
- Report success/failure
```

### Efficiency Math

For 50 steps:
- Learn: 3 calls
- Execute: 50 calls (1 per tap)
- Checkpoints: 5 calls (verify every 10 steps)
- Verify: 2 calls
- **Total: ~60 calls** ✅

---

## Strategy D: Batching (For Repetitive Tasks)

When the same action repeats (increment counter 10x, tap list items):

1. Find target once (1-2 calls)
2. Tap same coordinates N times (N calls)
3. Verify once (1 call)

**Example**: Increment sets from 5 to 15
- Find + button: 2 calls
- Tap 10 times: 10 calls
- Verify: 1 call
- **Total: 13 calls for 10 actions** = 1.3 calls/action

---

## Hierarchical Agents (For Very Long Workflows)

For workflows exceeding single-agent limits:

```
COORDINATOR AGENT
├── Sub-agent: Phase 1 (Setup)
│   └── Navigate to starting point, report coordinates
├── Sub-agent: Phase 2a (Work batch 1)
│   └── Execute steps 1-20
├── Sub-agent: Phase 2b (Work batch 2)
│   └── Execute steps 21-40
├── Sub-agent: Phase 2c (Work batch 3)
│   └── Execute steps 41-60
└── Sub-agent: Phase 3 (Verification)
    └── Confirm final state
```

Each sub-agent:
- Receives starting coordinates from previous phase
- Uses Trust mode internally
- Reports final state to coordinator

---

## Agent Prompt Template for Trust Mode

```
You are executing a LONG WORKFLOW using TRUST MODE.

DEVICE: {deviceId}
TASK: Complete the following {N} step workflow

TRUST MODE RULES:
1. Do ONE initial dump to learn the UI
2. MEMORIZE coordinates for: {list key elements}
3. Execute taps WITHOUT dumping between them
4. Checkpoint: dump ONLY at steps {checkpoint_steps}
5. If drift detected, recover and continue

WORKFLOW:
{numbered list of steps}

COORDINATE MEMORY (update after initial dump):
- Tab 1: x=?, y=?
- Tab 2: x=?, y=?
- Primary button: x=?, y=?
- {other key elements}

CHECKPOINTS: Steps {5, 10, 15, ...}
At checkpoints, dump and verify you're on expected screen.

MAX TOOL CALLS: {N + 15}

DRIFT RECOVERY:
- If on wrong screen: tap back or navigate to correct screen
- If dialog appeared: dismiss and retry
- If coordinates shifted: re-dump and update memory

REPORT:
---
TOTAL_TOOL_CALLS: [count]
STEPS_COMPLETED: [count]
CHECKPOINTS_PASSED: [count]
DRIFT_EVENTS: [count and description]
SUCCESS: [yes/no]
---
```

---

## Risk Mitigation

### 1. Drift Detection
- Checkpoints catch navigation errors early
- Recovery protocol re-establishes state

### 2. Coordinate Stability
- Most UIs have stable coordinates for key elements
- Dynamic content (lists, dates) needs fresh lookup

### 3. Context Management
- Trust mode minimizes context usage (no screenshots in loop)
- Dump responses are smaller than screenshots

### 4. Failure Recovery
- Back button usually recovers from wrong screen
- Force-stop + relaunch as last resort

---

## Recommendations

### For 50-step workflows:
1. Use **Trust Mode** (Strategy C)
2. Set checkpoints every 10 steps
3. Bake app navigation knowledge into prompt
4. Budget ~60 tool calls

### For 100+ step workflows:
1. Use **Hierarchical Agents** with Trust Mode
2. Split into 25-30 step chunks
3. Pass coordinates between phases
4. Coordinator tracks overall progress

### For repetitive workflows:
1. Combine **Trust Mode** with **Batching**
2. Find once, tap N times
3. Can achieve <1.0 effective calls/action

---

## Next Steps

1. **Implement Trust Mode template** as reusable agent prompt
2. **Test 50-step workflow** with Focus Strength app
3. **Build coordinator pattern** for 100+ step workflows
4. **Add to MCP docs** as recommended pattern

---

## Appendix: Experimental Data

### Strategy B (Lean) - Full Log
- Device: emulator-5554
- Steps: Settings toggles, workout interactions, calendar navigation
- Tool calls: 40
- Efficiency: 2.22 calls/step
- No failures detected

### Strategy C (Trust) - Full Log
- Device: emulator-5556
- Steps: 30 distinct interactions
- Verification dumps: 3 (checkpoints at steps 6, 12, 23)
- Drift detected: 1 (accidentally left app, recovered with back button)
- Efficiency: 1.0 calls/step

### Strategy D (Chunked) - Full Log
- Device: emulator-5558
- Batch: 10 taps on same FAB button
- Setup overhead: 13 calls
- Batch execution: 10 calls
- Efficiency: 2.3 calls/action (including setup)
