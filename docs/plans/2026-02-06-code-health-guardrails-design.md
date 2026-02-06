# Code Health Guardrails Design

**Date**: 2026-02-06
**PR**: #59
**Status**: Completed

## Problem

Large handler functions (300+ lines) made code hard to maintain. No automated checks prevented complexity from creeping back. Module-level mutable state (`lastFindResults`) created implicit coupling.

## Solution

### 1. Decompose handleUiTool

Broke the 345-line switch statement into a 6-line dispatcher with named handler functions:
- Extracted find operation to `src/tools/ui-find.ts` (265 lines, self-contained)
- Decomposed remaining 7 operations into named functions dispatched via a map in `src/tools/ui.ts`
- Applied same pattern to `handleAdbDeviceTool`, `handleEmulatorDeviceTool`, `handleAdbAppTool`

### 2. Move mutable state to ServerContext

Moved `lastFindResults` from module-level global to `ServerContext`, scoping it per server instance.

### 3. Automated guardrails

- **`scripts/check-complexity.sh`**: Checks file length (500 lines), function length (80 lines), unsafe casts, and index signatures. CLI command builders excluded.
- **PreToolUse hook** (`scripts/pre-pr-gate.sh`): Blocks `gh pr create` when complexity violations exist.
- **CI job** (`complexity-check`): Runs on every PR as a safety net.
- **Skills**: `/check-complexity`, `/health-report`, `/create-pr` for developer workflow.

### 4. Type tightening

- Removed `[key: string]: unknown` index signature from `ErrorContext`, added explicit `buildResult` field.
- Typed execa errors with `ExecaError` instead of manual duck-typing.
- Deleted backward-compat aliases: `FindWithOcrResult`, `FindOptions`, `findWithOcrFallback`.

## Files Changed

| File | Change |
|------|--------|
| `src/tools/ui.ts` | Decomposed 345-line switch to dispatcher |
| `src/tools/ui-find.ts` | **New** — extracted find operation |
| `src/tools/adb-device.ts` | Decomposed to named handlers |
| `src/tools/adb-app.ts` | Decomposed to named handlers |
| `src/tools/emulator-device.ts` | Decomposed to named handlers |
| `src/server.ts` | Moved state to ServerContext |
| `src/types/errors.ts` | Tightened ErrorContext type |
| `scripts/check-complexity.sh` | **New** — complexity checker |
| `scripts/pre-pr-gate.sh` | **New** — PreToolUse hook for PR gating |
| `.github/workflows/ci.yml` | Added complexity-check job |
| `CLAUDE.md` | Added Code Health Rules section |

## Outcome

- All 272 tests pass
- `check-complexity.sh` runs clean
- Handler functions reduced from 300+ lines to <80 lines each
- No module-level mutable state remains
