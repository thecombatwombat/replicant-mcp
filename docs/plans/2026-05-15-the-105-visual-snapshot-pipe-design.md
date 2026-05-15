# THE-105 — Fix `visual-snapshot`: internal pipe trips shell safety guard

Linear: https://linear.app/thecombatwombat/issue/THE-105
Branch: `fix/visual-snapshot-pipe`
Worktree: `../replicant-mcp-the-105` (keeps this checkout free for CU-2 / THE-106 in parallel — Wave A).
Parent epic: THE-104 (CU-1 of Wave A). Unblocks THE-107 (CU-3).

Initiative scope note: Waves A/B/C only for this session. Wave D (CU-10/11/12/13 — research and discussion tickets) deferred to a later session per user instruction 2026-05-15.

## Context

The 2026-05-14 agent evaluation found that `ui-capture` with `operation: "visual-snapshot"` returns `COMMAND_BLOCKED: Shell metacharacters are not allowed in shell commands`, while plain `screenshot` works. Root cause: an internal, trusted code path is hitting its own shell safety guard.

Confirmed via fresh code search (2026-05-15):

- `src/adapters/ui-automator.ts:373-408` `getCurrentApp` builds two `adb shell` payloads that pipe through `grep`:
  - `dumpsys activity activities | grep mResumedActivity`
  - `dumpsys window | grep mCurrentFocus`
- `src/services/process-runner.ts:158` `validateShellPayload` rejects `|` (regex `/[;&|\`()]|\$[({a-zA-Z_]/`). The guard is correct; the caller is wrong.
- `visualSnapshot` (`src/adapters/ui-automator.ts:410-435`) fans out to `getCurrentApp` via `Promise.all`, so any rejection there fails the whole snapshot.

Reproduced on `emulator-5554` via `mcp__replicant__ui-capture` — confirmed `COMMAND_BLOCKED` error.

Existing unit tests at `tests/adapters/ui-automator.test.ts:733-772` are **green** today because the mocks ignore the shell command string and return canned `dumpsys ... | grep`-shaped single-line output. They never assert the command shape — that is why the bug shipped.

The fix is at the caller: run `dumpsys activity activities` and `dumpsys window` directly with no pipe, then scan the multi-line output in TypeScript for the relevant line. Do not touch the shell safety guard.

## Setup (run once before edits)

1. From this checkout, create a sibling worktree:
   ```
   git fetch origin
   git worktree add -b fix/visual-snapshot-pipe ../replicant-mcp-the-105 origin/master
   ```
2. `cd ../replicant-mcp-the-105` and `npm install` if `node_modules` is empty.
3. All file edits in this plan happen inside the worktree, not the original checkout.

## Files to modify

- **`src/adapters/ui-automator.ts`** — rewrite `getCurrentApp` (lines 373-408) to drop pipes; parse `dumpsys` output line-by-line in TS.
- **`tests/adapters/ui-automator.test.ts`** — strengthen the `getCurrentApp` tests so they assert the issued shell command does NOT contain `|`, and add fixtures with real multi-line `dumpsys` output (resumed activity present, no resumed activity, multi-user u0/u10, fallback path via `mCurrentFocus`).
- **`tests/integration/visual-fallback.test.ts`** — add a regression test that exercises `handleUiCaptureTool` with a mocked `adb.shell` that runs the real `validateShellPayload` check (or a thin equivalent) so that any future regression that re-introduces shell metacharacters is caught at the integration boundary, not only at the unit level.
- **`DECISIONS.md`** — append entry under today's date: "Internal `adb shell` callers never use shell composition operators; parse output in TypeScript instead." This documents the invariant so the next contributor doesn't reintroduce a pipe.

## Implementation

1. **`getCurrentApp` rewrite** in `src/adapters/ui-automator.ts`:

   - Primary path: `adb shell dumpsys activity activities` (no pipe). Split stdout by newlines, find the first line containing `mResumedActivity` whose match regex is the existing `/([a-zA-Z0-9_.]+)\/([a-zA-Z0-9_.]+)\s+/`. Keep current matching semantics — line-by-line scan, return the first valid `package/activity` pair.
   - Fallback: `adb shell dumpsys window` (no pipe). Same line-scan strategy with the existing `mCurrentFocus` shape.
   - On no match in either, return `{ packageName: "unknown", activityName: "unknown" }` as today.
   - Extract the line-scanning logic into a small pure helper (e.g. `parseCurrentAppFromDumpsysActivities`, `parseCurrentAppFromDumpsysWindow`) so it can be unit-tested directly with realistic fixtures.

2. **Tool description / rtfm / privacy**:
   - `ui-capture` tool description (`src/tools/ui-capture.ts`) — no shape change, no edit needed.
   - `rtfm` content (`src/tools/rtfm.ts`) — no visual-snapshot mention found, no edit needed.
   - `PRIVACY.md` — no edit. Same `dumpsys` data source, no new data flow.

3. **DECISIONS.md** entry (new section, dated 2026-05-15):
   - Title: "Internal adb-shell payloads never use shell composition operators"
   - Context: visual-snapshot regression THE-105; `getCurrentApp` piped to `grep` and was rejected by its own shell safety guard.
   - Decision: trusted callers parse output in TypeScript; pipes/`&&`/`;`/backticks are reserved as user-input attack patterns the guard catches. The guard is the contract.
   - Alternatives considered (briefly): loosen the guard for internal callers (rejected — guard is the boundary), use `sh -c` wrapper (rejected — would also be blocked and weakens the model).

## Verification

End-to-end:
1. `npm run build` succeeds.
2. `npm run test:coverage` passes, with coverage thresholds satisfied.
3. `npm run lint` clean.
4. From an MCP client against `emulator-5554`:
   ```
   adb-device select --deviceId emulator-5554
   ui-capture operation=visual-snapshot
   ```
   Expect a result object with populated `screenshotPath`, `screen`, and `app.packageName` / `app.activityName` (no `COMMAND_BLOCKED`).
5. Open a non-trivial app on the emulator before re-running so `app.packageName` is not `unknown`.
6. Optional spot check: with launcher in focus, fallback path is exercised — `app.packageName` should be the launcher package, not `unknown`.

Unit tests must cover:
- `getCurrentApp` returns the correct `(package, activity)` on a realistic multi-line `dumpsys activity activities` fixture.
- `getCurrentApp` falls back to `dumpsys window` when the activity fixture has no `mResumedActivity` line.
- `getCurrentApp` returns `unknown/unknown` when both fixtures are empty / malformed.
- The issued `adb.shell` command strings contain neither `|` nor any other character from `/[;&|\`()]|\$[({a-zA-Z_]/` — assert directly with regex against the captured mock call args. This is the test that would have caught the original bug.
- Multi-user fixture (`u0` resumed and `u10` resumed in same dump) — confirm the first one wins, matching today's behavior.

Integration test must cover:
- `handleUiCaptureTool({ operation: "visual-snapshot" })` end-to-end via real `UiAutomatorAdapter` with mocked `adb.shell` that wraps the actual `validateShellPayload` (or simulates it). Failing this catches any future regression that re-introduces shell metacharacters in `getCurrentApp` or any other internally-built shell payload along the snapshot path.

## Out of scope (call out in PR description, do NOT touch in this PR)

- Other internal callers that may follow the same pipe-to-grep pattern. None found today via `grep -rn "dumpsys" src/ --include='*.ts'`, but list as a follow-up audit in the PR body.
- Generalizing the safety-guard for internal callers — explicitly excluded by the ticket.
- Changing the `dumpsys` data source.

## PR mechanics

- Branch: `fix/visual-snapshot-pipe`. Never push to master.
- `/create-pr` once tests pass.
- Wait for Greptile, then human approval. Do not auto-merge.
- PR description quotes the agent feedback, links THE-105, mentions THE-107 unblocked.
