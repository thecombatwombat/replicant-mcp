# Prompt for the next session

Copy everything below the line into a fresh Claude Code session opened in
this worktree (`.worktrees/remote-mode`).

---

I'm picking up `feature/remote-mode` after a code review pass. The branch is
5 commits ahead of master and adds a `replicant-mcp serve --http` subcommand
that wraps `sparfenyuk/mcp-proxy` via `uvx`, plus a one-shot retry in
`AdbAdapter` for transient device errors. Build/lint/tests are green at
HEAD (701 passing).

**Read these first, in order, before touching code:**

1. `CLAUDE.md` — project conventions (test-before-implement, atomic
   conventional commits, never push to master, file/function size limits).
2. `docs/reviews/2026-05-09-feature-remote-mode/claude-opus.md` — the
   review. Start at the **Triage** section, not the full body.
3. `~/.claude/plans/add-a-remote-mode-binary-fog.md` — the original plan,
   for context on *why* each piece exists.

**What I want you to do:**

Fix the **Block-on-merge** items in the triage table (C1, C2, H1, H4, L3,
M1) and resolve the three **Investigate** items (C3/OQ2, OQ1, OQ3) — for
those, either fix the underlying issue or document the verified behaviour
in `docs/remote.md`. Skip the "Lower priority — defer if time-pressed"
list unless something jumps out as quick.

**Working rules:**

- Test-first per CLAUDE.md. For each finding, write the failing test first,
  then the fix, then run `npx vitest --run` to confirm green before
  committing.
- One atomic conventional commit per finding (or per closely-related set).
  Commit prefix: `fix(serve)`, `fix(adb)`, `docs:`, etc. Don't bundle
  unrelated changes.
- After each commit, run the full suite (`npx vitest --run`) and
  `npm run build`. Don't let red linger.
- Update the triage table in `claude-opus.md` as you close items — add a
  one-line "addressed in &lt;commit-sha&gt;" so the trail is obvious.

**A few specific gotchas the review flagged:**

- **C1 / banner to stderr:** the `tests/cli/serve.test.ts` assertions
  currently grep `out` (stdout); they need to move to `err` (stderr) when
  you flip the banner stream. Also collapse `log` and `errLog` in
  `ServeDeps` — there's no reason serve mode should ever write stdout.
- **C2 / signal handlers:** wire `child.on(exit/error)` *before* the
  signal loop; add SIGKILL escalation on second Ctrl-C; remove
  `process.on` listeners on child exit; consider injecting `processOn`
  via `ServeDeps` (M8) so tests can verify the cleanup.
- **H1 / wait-for-device:** carry `-s &lt;deviceId&gt;` into the retry's
  wait-for-device call (extract from the original args at index after
  `-s`). Short-circuit when args already contain `wait-for-device`. The
  review has a fix sketch.
- **L3 / banner JSON:** wrap the snippet in `"mcpServers": { … }`. The
  current banner produces a config nothing parses.
- **M1 / PRIVACY.md:** add a Remote Mode section. Mention `uvx` fetches
  `mcp-proxy` from PyPI on first launch. CLAUDE.md mandates the policy
  review for any new network surface.
- **C3 / OQ2 / `--pass-environment`:** verify what mcp-proxy actually
  propagates (proxy-only vs. backend) with a smoke test:
  `ANDROID_HOME=/tmp/nope replicant-mcp serve --http --host 127.0.0.1`,
  drive a tool call from a client, see whether the error references
  `/tmp/nope`. Then either narrow to an explicit allowlist or document
  the behaviour. Either way, mention it in `docs/remote.md`.
- **OQ1 / OQ3 / signal & crash forwarding:** smoke-test these on the
  host. `kill -TERM` the proxy and confirm no orphan node processes;
  `kill -KILL` the inner node and observe whether mcp-proxy hangs or
  dies. Update `docs/remote.md` "What happens when …" section with
  what you actually observed.

**End-of-session expectations:**

When all triage items are closed (or explicitly punted with a note in
`claude-opus.md`), invoke `superpowers:finishing-a-development-branch`
and create the PR via `/create-pr`. Don't push to master under any
circumstances; project policy in CLAUDE.md is explicit.

**Useful paths:**

```
worktree:         /Users/architjoshi/code/claude/replicant-mcp/.worktrees/remote-mode
branch:           feature/remote-mode
review notes:     docs/reviews/2026-05-09-feature-remote-mode/claude-opus.md
authoring plan:   ~/.claude/plans/add-a-remote-mode-binary-fog.md
```
