# replicant-mcp

Android MCP server for AI-assisted Android development.

## Quick Start

```bash
npm install
npm run build
npm start
```

## Tool Categories

- **gradle-*** - Build and test Android apps
- **emulator-device** - Manage Android emulators
- **adb-*** - Device and app control
- **ui** - Accessibility-first UI automation
- **cache** - Manage response cache
- **rtfm** - On-demand documentation

## Key Patterns

1. **Progressive Disclosure**: Tools return summaries with cache IDs. Use `*-get-details` for full output.
2. **Single Device Focus**: Use `adb-device list` then `adb-device select` to choose active device.
3. **Accessibility-First**: Prefer `ui dump` over screenshots for UI interaction.

## Decision Log

**Before making architectural or workflow choices, check `DECISIONS.md`.** It records why past decisions were made and what alternatives were rejected. When you make a significant decision — architectural (new patterns, technology choices, design trade-offs) OR workflow (process changes, enforcement mechanisms, convention changes) — add an entry.

## MCP Resources

- **Context7**: Always use Context7 MCP for library/API documentation, code examples, setup steps, and configuration guidance—no need to ask first.

## Common Workflows

**Build and install:**
```
gradle-list { operation: "variants" }
gradle-build { operation: "assembleDebug" }
adb-app { operation: "install", apkPath: "..." }
```

**Debug crash:**
```
adb-logcat { package: "com.example", level: "error", lines: 50 }
```

**UI automation:**
```
ui { operation: "dump" }
ui { operation: "find", selector: { text: "Login" } }
ui { operation: "tap", elementIndex: 0 }
```

## Current Status

- **MCP server**: Complete and working. Published to npm as `replicant-mcp`.
- **CI**: Passing (464 tests).
- **Distribution**: npm + git clone. Claude Desktop and Claude Code instructions in README.

## Releasing

**Always use the release script** - never manually bump versions, tag, or publish.

```bash
# Preview what would happen (safe, no side effects)
./scripts/release.sh --dry-run
./scripts/release.sh minor --dry-run

# Execute release
npm run release          # patch: 1.2.1 → 1.2.2
npm run release:minor    # minor: 1.2.1 → 1.3.0
npm run release:major    # major: 1.2.1 → 2.0.0
```

**Version type guidance:**
- `patch` - Bug fixes, small improvements, doc updates
- `minor` - New features, new tool parameters, backward-compatible changes
- `major` - Breaking changes to tool schemas or behavior

**The script handles prep and push:**
1. Pre-flight checks (branch, clean state, synced, version available)
2. Tests
3. Version bump + commit + tag
4. Push to origin

**CI handles publish (triggered by the `v*` tag push):**
1. Publish to npm (OIDC trusted publisher, with provenance)
2. Create GitHub Release with auto-generated notes

**If release fails mid-way:** The script runs checks before any destructive actions. If it fails after committing (rare), you may need to manually clean up the tag/commit.

## Future Work

- **Claude Code skill layer**: Removed due to architectural issues (shell scripts depended on built CLI that wasn't available after marketplace install). Revisit with one of these approaches:
  1. Commit `dist/` to repo (quick but not ideal)
  2. Rewrite scripts to use direct adb/gradle commands (no CLI dependency)
  3. Have scripts use globally installed npm package (`npx replicant-mcp`)

## Issue Tracking (Beads)

This project uses beads for issue-driven development with **parallel agent execution**.

### Epic Structure

All work is organized into epics (top-level work areas). View with `bd epic status` or `bd graph --all --compact`.

**RULE: Every issue must be part of the tree.**
- Create epics: `bd create --type=epic --title="..."`
- Create child issues: `bd create --parent=<epic-id> --title="..." --type=task`
- NO orphan issues allowed (enforced by PreToolUse hook)

### Parallel Execution Model

1. **One agent per epic** - Each epic is independently executable
2. **Sub-agents for children** - Parallelize work within an epic
3. **Dependencies control order** - `bd dep add <issue> <depends-on>`

View parallelizable work:
```bash
bd ready              # Issues with no blockers
bd graph --all        # Full dependency tree
bd blocked            # What's waiting on what
```

### Task Granularity

The unit of work is: one agent, one session, one task.
- Split work into independently-completable subtasks under epics
- Each task = one agent can claim and finish it without coordinating mid-flight
- Use dependencies to control execution order (`bd dep add <task> <depends-on>`)
- Sweet spot: 15-60 min of agent work per task. Don't go finer than one coherent commit.
- Goal: `bd ready` returns multiple parallelizable items whenever possible

### Before Brainstorming

Run `bd ready` and `bd list --status=in_progress`, present as dashboard:

```markdown
## 📋 Project Context

| | |
|---|---|
| **Project** | replicant-mcp (Android MCP server) |
| **Status** | [version], [test count] passing |
| **Recent** | [2-3 recent changes from git log] |

**Ready Epics:**
| Pri | ID | Title | Progress |
|-----|-----|-------|----------|
| P1 | `xxx` | ... | 2/5 |

**What would you like to brainstorm?**
```

### Issue Readiness Tags

Issues use description tags to indicate what's needed before execution:

```
[Needs: design]           ← Brainstorm first, then remove
[Needs: plan]             ← Write implementation plan, then remove
[Design: path/to/doc.md]  ← Link to completed design
[Plan: path/to/plan.md]   ← Link to completed plan
```

**Agent decision tree:**
1. Pick issue from `bd ready`
2. Has `[Needs: design]`? → Brainstorm → Update issue (remove tag, add `[Design: ...]`)
3. Has `[Needs: plan]`? → Write plan → Update issue (remove tag, add `[Plan: ...]`)
4. Execute (read linked docs for context)

**No tag = ready to execute.** Only add tags when design/planning is needed.

### After Design is Complete

1. Persist plan to `docs/plans/YYYY-MM-DD-<topic>-design.md` immediately (don't wait for PR)
2. Identify or create the parent epic
3. Create child issues under it:
   ```bash
   bd create --parent=<epic-id> --title="..." --type=task
   ```
4. Add readiness tags if needed: `[Needs: design]` or `[Needs: plan]`
5. Set dependencies between related issues:
   ```bash
   bd dep add <issue> <depends-on>
   ```
6. Reference issue IDs in design docs and commits

**Before ending session (Landing the Plane):**
1. Persist any finalized plans to `docs/plans/` (if not already done after plan approval)
2. Ensure all work has beads issues under epics with correct dependencies
3. File remaining work as issues
4. Update issue statuses (`bd close`, `bd update --status=...`)
5. Clean up worktrees: `git worktree list` → `git worktree remove <path>` for any in `.worktrees/`
6. Push everything: `git pull --rebase && bd sync && git push`
7. Verify: `git status` shows "up to date with origin"

## Code Health Rules

- File limit: 500 lines. Function limit: 80 lines. CLI command builders (`src/cli/`) are excluded from function checks.
- Tool operations are separate named functions; main handler dispatches.
- No module-level mutable state. Use ServerContext.
- Use ReplicantError. Never swallow errors silently.
- Run `npm run check-complexity` to verify before creating PRs.
- Every non-trivial task must have a beads issue before work starts. Create under a parent epic with dependencies.
- Finalized plans must be persisted to `docs/plans/YYYY-MM-DD-<topic>-design.md` immediately after plan approval.
- Link plans to beads issues: `bd update <id> --description "[Plan: docs/plans/YYYY-MM-DD-<topic>.md]"`

## Testing Standards

**Coverage is enforced.** Thresholds are defined in `vitest.config.ts` and checked in CI. PRs that drop coverage will fail.

**Test before implement:** For new features, write tests first or immediately after implementation — not as an afterthought.

**Test structure:**
- Unit tests: `tests/<category>/` matching src structure
- Integration tests: `tests/integration/` for multi-component flows
- Follow existing patterns (see `tests/tools/cache.test.ts`): describe/beforeEach/it blocks

**What to test:**
- ✅ Happy paths + error cases + edge cases
- ✅ Retry logic, timeout handling, failure modes
- ✅ Boundary inputs (empty, null, max values)
- ✅ External dependency mocking (adb, gradle, file system)
- ❌ NOT just smoke tests — comprehensive behavioral coverage required

**When coverage fails:** Run `npm run test:coverage` locally to check current thresholds and fix before PR.

## PR Workflow

Use `/create-pr` for all PRs. It runs code-simplifier and complexity checks automatically.
If using `gh pr create` directly, the PreToolUse hook enforces the same checks.
CI re-checks on the PR as a safety net.

## Workflow Rules

- **No direct pushes to master**: All changes must go through pull requests
- **PR workflow**: After creating a PR, automatically monitor for Greptile review. Address feedback and request re-review. If Greptile keeps raising concerns you disagree with, file a ticket and ask the user for review instead. Wait for human approval before merging. Never merge-then-monitor.
- **Branch naming**: Use prefixes:
  - `feature/` - new functionality
  - `fix/` - bug fixes
  - `docs/` - documentation only
  - `refactor/` - code restructuring without behavior change
  - `chore/` - maintenance tasks (deps, CI, tooling)
  - `trivial/` - typos, minor doc fixes (skips beads check in PR gate)
- **Branch format**: `<prefix>/<short-description>` (e.g., `feature/visual-fallback`, `fix/gradle-timeout`)

## Documentation Rules

- **Keep README roadmap in sync**: When planning new features or completing existing ones, update the "Current Features" and "Future Roadmap" tables in README.md:
  - New planned features: Add to Future Roadmap with status "Planned"
  - Completed features: Move from Future Roadmap to Current Features
  - Status values: "Planned" (next up), "Future" (later phases), "In Progress" (actively being built)
- **Update roadmap mapping**: When adding new roadmap items, also add an entry to `.github/roadmap-mapping.yml` so the PR workflow can detect when features are completed
- **Design docs**: Store in `docs/plans/` with format `YYYY-MM-DD-<topic>-design.md`
