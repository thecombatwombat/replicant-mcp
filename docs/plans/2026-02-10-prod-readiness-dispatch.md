# Production Readiness Dispatch Plan

**Epic:** `replicant-mcp-3wk`
**Rollback:** `git reset --hard 004ebd9` (or tag `pre-prod-readiness`)

## Waves

### Wave 1: 5 Parallel Agents

| Agent | Branch | Issues | Type |
|-------|--------|--------|------|
| 1 | `docs/security` | `e62`, `30r`, `m6b`, `t7g` | docs |
| 2 | `docs/user-guidance` | `e6z`, `kjl`, `b4n`, `9t3`, `eon` | docs |
| 3 | `fix/version-mismatch` | `lom` | code |
| 4 | `fix/replicant-errors` | `cgg` | code |
| 5 | `fix/logcat-filtering` | `teq` | code |

### Wave 2: 3 Parallel Agents

| Agent | Branch | Issues | Type |
|-------|--------|--------|------|
| 6 | `feature/structured-logging` | `8l0` | code (has design doc) |
| 7 | `feature/health-check` | `4qd` | code (has design doc) |
| 8 | `feature/test-regression` | `3wk.1` | code (has design doc) |

### Wave 3: 2 Agents

| Agent | Branch | Issues | Type |
|-------|--------|--------|------|
| 9 | `feature/output-schemas` | `x03`, `db2`, `91d`, `c8k` | code (sequential) |
| 10 | `docs/readme-links` | — (cleanup) | docs |

## File Conflict Map

### Wave 1 (verified: zero overlaps)

| Agent | Files |
|-------|-------|
| 1 | `SECURITY.md`, `docs/security.md`, `CHANGELOG.md`, `docs/api-stability.md` |
| 2 | `SUPPORT.md`, `docs/known-limitations.md`, `docs/artifacts.md`, `docs/support-matrix.md`, `docs/configuration.md` |
| 3 | `src/version.ts` (new), `src/server.ts`, `src/cli.ts` |
| 4 | `src/types/errors.ts`, `src/tools/adb-app.ts`, `adb-device.ts`, `ui.ts`, `ui-find.ts`, `cache.ts`, `emulator-device.ts`, `gradle-list.ts` |
| 5 | `src/adapters/adb.ts`, `src/tools/adb-logcat.ts` |

### Wave 2 (verified: zero overlaps)

| Agent | Files |
|-------|-------|
| 6 | `src/utils/logger.ts` (new), `src/index.ts`, `src/services/config.ts` |
| 7 | `src/cli/doctor.ts` (new), `src/cli.ts`, `src/cli/index.ts` |
| 8 | `src/services/test-baseline.ts` (new), `src/tools/gradle-test.ts` |

### Wave 3

| Agent | Files |
|-------|-------|
| 9 | `src/types/schemas/` (new, ~12 files), `tests/`, `docs/contracts/`, `scripts/contract-test.ts` |
| 10 | `README.md` |

## Rules

1. **No agent touches README.md** except Agent 10 (final cleanup)
2. **Wave N+1 branches from merged master** — never pre-create future wave branches
3. **Each agent reads its beads issue** for the full spec. Design issues also read linked `docs/plans/` doc.
4. **Beads issues must be in_progress** before creating PR (pre-PR gate enforces this)

## Coverage Safety

Margins are razor-thin:
- Lines: 68.71% vs 68% threshold (0.71% margin)
- Functions: 63.17% vs 63% threshold (**0.17% margin**)

Rules:
- **All code agents** (3-9) MUST run `npm run test:coverage` before PR and verify all 4 thresholds pass
- **Output schemas** go in `src/types/schemas/` (excluded from coverage via `src/types/**` in vitest.config.ts)
- **Doc-only PRs** (1, 2, 10) skip coverage in CI (`docs/` branch prefix)
- Every new exported function in `src/` needs test coverage

## Pre-PR Gate

`scripts/pre-pr-gate.sh` enforces:
1. Beads issue exists and is `in_progress` for the branch
2. No complexity violations (`npm run check-complexity`)

Agents must: `bd update <issue-id> --status=in_progress` before starting work.

## Merge Protocol

1. All agents in a wave create PRs via `gh pr create`
2. User batch-reviews all PRs in the wave
3. Merge order within a wave doesn't matter (no file overlaps)
4. After merging, lead agent cleans up worktrees before creating next wave branches

## Failure Handling

- Failed agent doesn't block the wave — other PRs can merge
- Retry: create fresh branch from current master, re-dispatch with same beads spec
- Coverage failure: add more tests in the failing PR before re-pushing
- Crashed worktree: `git worktree remove .worktrees/<name>`

## Orchestrator Workflow

```
1. Tag rollback: git tag pre-prod-readiness
2. For each wave:
   a. Create worktrees: git worktree add .worktrees/<name> -b <branch>
   b. Mark beads issues in_progress
   c. Spawn agents (read issue spec from beads)
   d. Wait for completion
   e. Notify user for batch review
   f. After merge: git worktree remove .worktrees/<name>
3. Final: bd close all issues + sub-epics + epic, bd sync
```

## Verification (After All Waves)

1. `npm test` — 330+ tests pass
2. `npm run test:coverage` — all 4 thresholds met
3. `npm run check-complexity` — clean
4. All new docs exist and README links resolve
5. `npx replicant --version` matches package.json
6. `REPLICANT_LOG_LEVEL=debug node dist/index.js 2>log.txt` — log.txt has output, stdout clean
7. `npx replicant doctor` — produces structured output
8. `bd show replicant-mcp-3wk` — epic closed, all children closed
9. `adb-logcat { package: "com.example", since: "01-20 15:30:00.000" }` — filtered output
10. `npm run test:contracts` — passes
