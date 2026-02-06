# Agentic Flywheel Evaluation: replicant-mcp

**Date:** 2026-02-06
**Version evaluated:** 1.4.7 (237 tests passing)
**Scope:** replicant-mcp as an Android MCP server enabling AI agents to build, test, deploy, and debug Android apps

---

## Framework

The Agentic Flywheel is a four-stage loop where AI agents autonomously handle a product lifecycle:

```
Release → Monitor → Diagnose → Fix → Release → ...
```

A human sits at the executive layer (approving releases, setting priorities). The agent handles execution. For replicant-mcp, the "product" is an Android application being developed by an AI agent using MCP tools.

---

## Stage 1: Release

**Goal:** Ship changes to production — build, test, deploy to device/store.

### Coverage

| Capability | Tool / File | What it does |
|---|---|---|
| Build APK/AAB | `gradle-build` (`src/tools/gradle-build.ts`) | `assembleDebug`, `assembleRelease`, `bundle` with module/flavor support |
| Run tests | `gradle-test` (`src/tools/gradle-test.ts`) | `unitTest`, `connectedTest` with filter support, structured pass/fail/skip results |
| Install to device | `adb-app` (`src/tools/adb-app.ts`) | `install` operation with APK path |
| Launch app | `adb-app` | `launch` operation by package name |
| Introspect project | `gradle-list` (`src/tools/gradle-list.ts`) | `variants`, `modules`, `tasks` |
| Inspect build output | `gradle-get-details` (`src/tools/gradle-get-details.ts`) | Retrieve full logs/errors/tasks by buildId |
| npm release | `scripts/release.sh` | Automated version bump → test → build → npm publish → GitHub release |
| CI pipeline | `.github/workflows/ci.yml` | Multi-platform matrix testing, complexity checks, publish dry-run |

### Gaps

1. **No end-to-end release orchestration.** The tools are discrete primitives (build, test, install). No single tool or workflow chains them: build → test → install → launch → verify. An agent must manually sequence these calls.
2. **No Play Store / Firebase App Distribution integration.** `adb-app install` only deploys to a local device. There's no tool to push to a distribution channel for real users.
3. **No post-install verification.** After `adb-app install` + `launch`, there's no built-in health check that the app actually started correctly (e.g., check for crash in first 5s of logcat).
4. **No signing configuration management.** `assembleRelease` and `bundle` assume signing is configured in Gradle. No tooling to manage keystores or signing configs.

### Maturity: **functional**

The build → test → install → launch chain works and is exercised in CI. An agent can execute a full local release. But there's no orchestrated workflow, no distribution beyond local device, and no post-deploy verification.

### Next concrete step

**Build a `release-check` composite operation** that chains: build → test → install → launch → logcat (5s, error level) → report success/failure. This turns five manual tool calls into one, and adds the missing post-deploy health check. This is an orchestration layer, not a new primitive.

---

## Stage 2: Monitor

**Goal:** Observe production health — crashes, metrics, user signals.

### Coverage

| Capability | Tool / File | What it does |
|---|---|---|
| Device logs | `adb-logcat` (`src/tools/adb-logcat.ts`) | Filter by package, tag, level, time; error/warn counts in summary |
| Device health | `adb-device health-check` (`src/tools/adb-device.ts:78-113`) | SDK validation, adb server status, device connectivity |
| App state | `adb-app list` | Check if app is installed |
| UI state | `ui dump` (`src/tools/ui.ts`) | Accessibility tree snapshot — can detect crash dialogs, ANR dialogs |
| Screenshots | `ui screenshot` / `ui visual-snapshot` | Visual state capture |
| Environment health | `scripts/check-env.sh` | Pre-session validation of Android toolchain |

### Gaps

1. **No continuous monitoring.** All tools are point-in-time queries. There's no `adb-logcat --watch` that streams logs and fires alerts on patterns (e.g., `FATAL EXCEPTION`, `ANR`). An agent must poll.
2. **No crash detection tool.** While `adb-logcat` can filter for errors, there's no dedicated crash monitor that parses `AndroidRuntime` fatal exceptions, extracts stack traces, and returns structured crash reports.
3. **No performance metrics.** No tooling for CPU usage, memory consumption (`dumpsys meminfo`), frame rate (`dumpsys gfxinfo`), or battery drain. These are critical production health signals.
4. **No Firebase Crashlytics / analytics integration.** For real production monitoring, device-local logcat is insufficient. There's no connection to cloud-based crash reporting or analytics services.
5. **No baseline comparison.** Even for local metrics, there's no way to say "memory usage increased 40% since last build."

### Maturity: **scaffolded**

The building blocks exist — logcat, UI dump, and health checks can detect obvious problems. But there's no continuous observation, no structured crash extraction, no performance telemetry, and no alerting. An agent would need to manually poll `adb-logcat` in a loop and parse raw text.

### Next concrete step

**Add `adb-crash-monitor` tool** with operations: `check` (one-shot crash scan of recent logcat) and `watch` (poll logcat every N seconds, return structured crash reports). Output: `{ crashed: boolean, exceptions: [{ type, message, stackTrace, package, timestamp }], anrs: [...] }`. This converts raw log text into agent-actionable data.

---

## Stage 3: Diagnose

**Goal:** Identify root cause when something breaks.

### Coverage

| Capability | Tool / File | What it does |
|---|---|---|
| Build error details | `gradle-get-details` (`src/tools/gradle-get-details.ts`) | Full logs, extracted errors, task list from failed builds |
| Test failure details | `gradle-test` return value | Structured `failures` array with test names |
| Log analysis | `adb-logcat` | Filter logs around time of failure |
| Shell access | `adb-shell` (`src/tools/adb-shell.ts`) | Run diagnostic commands (`dumpsys`, `pm`, `am`) with safety guards |
| UI inspection | `ui dump` + `ui find` | Inspect current UI state, check for error dialogs |
| Device properties | `adb-device properties` | SDK version, hardware info for device-specific bugs |
| Structured errors | `src/types/errors.ts` | 16 error codes with suggestions (e.g., `BUILD_FAILED` includes "Check gradle-get-details") |

### Gaps

1. **No stack trace parser.** When a crash occurs, the agent gets raw logcat text. There's no tool that extracts and structures a Java/Kotlin stack trace into `{ exception, message, file, line, causedBy }`.
2. **No `dumpsys` wrappers.** `adb-shell` can run `dumpsys activity`, `dumpsys meminfo`, etc., but the output is raw text. Structured parsing of common dumpsys outputs would make diagnosis faster.
3. **No diff-based diagnosis.** No ability to compare two builds' test results, two logcat captures, or two UI dumps. "What changed?" is a fundamental diagnostic question.
4. **No source code correlation.** The MCP server knows about the Android app but has no tools to read/search the app's source code. An agent must use separate tools (file read, grep) to correlate a crash stack trace to source.
5. **No ANR trace analysis.** ANR (Application Not Responding) traces from `/data/anr/traces.txt` are a key diagnostic artifact. No tool pulls or parses them.

### Maturity: **scaffolded**

The raw data is accessible — build logs, test results, logcat, shell commands. But diagnosis requires the agent to do heavy text parsing. There are no structured diagnostic tools that turn raw output into root-cause hypotheses.

### Next concrete step

**Add a `diagnose` tool** that takes a crash report or build failure and returns structured analysis: parsed stack trace, relevant source file + line, similar past crashes (if any), and suggested fix categories. Start with just stack trace parsing from logcat — that alone eliminates the biggest manual step in diagnosis.

---

## Stage 4: Fix

**Goal:** Generate and validate a repair.

### Coverage

| Capability | Tool / File | What it does |
|---|---|---|
| Rebuild after fix | `gradle-build` | Verify fix compiles |
| Retest after fix | `gradle-test` | Verify fix passes tests |
| Reinstall + launch | `adb-app` | Deploy fixed version |
| UI verification | `ui dump` + `ui find` + `ui tap` | Verify UI works after fix |
| Safety guards | `ProcessRunner` (`src/services/process-runner.ts`) | Prevents destructive commands during fix attempts |
| Error suggestions | `ReplicantError.suggestion` field | Each error code includes a suggested next action |

### Gaps

1. **No source code editing.** replicant-mcp has zero tools for reading or modifying the Android app's source code. The fix must happen through a separate channel (the host agent's file editing tools). This is the biggest gap — the flywheel breaks here because control must transfer out of the MCP server.
2. **No fix validation workflow.** There's no tool that says "apply this fix, rebuild, retest, and tell me if it worked." The agent must manually sequence: edit file → gradle-build → gradle-test → check results.
3. **No rollback mechanism.** If a fix makes things worse, there's no tool to revert to the previous APK or git state. The agent must use git commands outside replicant-mcp.
4. **No test generation.** When fixing a bug, agents should add a regression test. No tooling supports test scaffolding or test template generation.

### Maturity: **scaffolded**

The verification half of Fix is solid — rebuild, retest, reinstall, UI verify all work. But the generation half (actually modifying code) is entirely outside replicant-mcp's scope. This is arguably by design (the host agent handles code editing), but it means the flywheel always requires leaving the MCP server context for the most critical step.

### Next concrete step

**Add `gradle-test-file` tool** that reads a test result, identifies the failing test file path, and returns its source code. This doesn't add code editing, but it closes the loop from "test X failed" → "here's what test X looks like" → agent can reason about the fix. Combined with the host agent's file tools, this makes the Fix stage much faster.

---

## Summary Table

| Stage | Coverage | Maturity | Top Gap |
|---|---|---|---|
| **Release** | Build, test, install, launch — all functional as discrete tools. Automated npm release. | **functional** | No orchestrated build→test→deploy→verify workflow |
| **Monitor** | Point-in-time logcat, health checks, UI dumps | **scaffolded** | No continuous crash monitoring or performance metrics |
| **Diagnose** | Raw data accessible (logs, test results, shell) | **scaffolded** | No structured crash/stack trace parsing |
| **Fix** | Rebuild + retest + reinstall works | **scaffolded** | No source code access — fix generation happens outside MCP |

---

## Prioritized Backlog: Accelerating the Flywheel as a System

These items are ordered by system-level impact — how much they accelerate the entire loop, not just one stage. Dependencies between stages are the key consideration: a bottleneck in Diagnose blocks Fix, which blocks Release, which means Monitor has nothing new to observe.

### 1. Crash monitor with structured output (Monitor → Diagnose bridge)

**What:** `adb-crash-monitor` tool with `check` operation. Scans recent logcat for `AndroidRuntime` fatal exceptions and ANRs. Returns structured `{ crashed, exceptions: [{ type, message, stackTrace, package, timestamp }], anrs: [...] }`.

**Why this is #1:** This single tool bridges Monitor and Diagnose. Currently, an agent sees raw logcat text and must parse it manually. Structured crash data flows directly into diagnosis without human text-parsing. This is the highest-leverage point because it unlocks the Monitor→Diagnose transition, which is currently the weakest link.

**Depends on:** Nothing. Uses existing `adb-logcat` infrastructure.

### 2. Post-deploy health check (Release → Monitor bridge)

**What:** After `adb-app install` + `launch`, automatically capture 5 seconds of logcat (error level, filtered to the app's package) and check for crashes. Return `{ healthy: boolean, crashReport?: ... }`. Can be a standalone tool or an option on `adb-app launch`.

**Why:** Closes the Release→Monitor gap. Currently, "deploy and hope" is the default. This makes every release self-verifying. Combined with #1, a crashed deploy is immediately detected and structured for diagnosis.

**Depends on:** #1 (crash monitor) for structured crash output.

### 3. Stack trace parser (Diagnose acceleration)

**What:** Tool or utility that takes raw logcat crash text and returns `{ exceptionType, message, frames: [{ class, method, file, line }], causedBy?: ... }`. Correlate frames to Gradle module structure if available.

**Why:** The Diagnose→Fix transition requires understanding _where_ the bug is. A parsed stack trace with file:line references lets the host agent immediately open the right file. Without this, agents waste cycles pattern-matching raw text.

**Depends on:** #1 feeds it data. Can also accept raw text input.

### 4. Build-test-deploy orchestration tool (Release acceleration)

**What:** A `workflow` or `deploy-and-verify` composite tool that chains: `gradle-build` → `gradle-test` → `adb-app install` → `adb-app launch` → health check. Returns a single structured result with pass/fail at each stage and the first failure's details.

**Why:** Reduces the agent's per-iteration overhead. Today, a build→test→deploy→verify cycle is 5+ tool calls with manual error checking between each. As a single tool, the agent can iterate faster (fix → one call → result). Speed of iteration is what makes a flywheel spin.

**Depends on:** #2 (post-deploy health check) for the verify step.

### 5. Performance baseline tool (Monitor depth)

**What:** `adb-perf` tool that captures `dumpsys meminfo <package>`, `dumpsys gfxinfo <package>`, and CPU usage. Stores baselines per build in cache. Returns `{ memory: { current, baseline, delta }, frameRate: { current, baseline, delta }, ... }`.

**Why:** Catches regressions that don't crash but degrade the product — memory leaks, frame drops, battery drain. These are invisible to crash monitoring but matter for production quality. This deepens the Monitor stage from "did it crash?" to "is it healthy?"

**Depends on:** Existing `adb-shell` and cache infrastructure. Independent of #1-#4.

---

## Flywheel Maturity Assessment

```
          Release ████████░░ functional
              ↓
          Monitor ████░░░░░░ scaffolded
              ↓
         Diagnose ███░░░░░░░ scaffolded
              ↓
              Fix ███░░░░░░░ scaffolded (code editing outside MCP by design)
              ↓
          Release ...
```

**Current state:** The flywheel can turn, but slowly and with manual intervention at each stage transition. An agent can build, install, check logs, and iterate — but it must do significant text parsing and manual orchestration between stages.

**After backlog items 1-4:** The flywheel turns semi-autonomously for the crash→diagnose→fix→rebuild loop. The agent gets structured data at each stage and can iterate with minimal overhead. The main human touchpoint remains code review before release.

**Long-term:** Full autonomy would require Play Store deployment (#1's "real production"), cloud crash reporting integration, and possibly source-code-aware diagnosis. But the local development loop — which is where 80% of iteration happens — can be fully autonomous with the backlog above.
