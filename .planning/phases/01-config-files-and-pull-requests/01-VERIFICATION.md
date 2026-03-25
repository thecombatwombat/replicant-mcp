---
phase: 01-config-files-and-pull-requests
verified: 2026-03-25T10:08:59Z
status: gaps_found
score: 3/4 success criteria verified
re_verification: false
gaps:
  - truth: "All 5 PRs contain only the files specified in the per-marketplace plan docs"
    status: failed
    reason: "PRs #101, #102, and #104 each contain 19 unrelated .planning/ files alongside the intended config files. The branches were not rebased onto origin/master before pushing. PR #103 was correctly rebased; PR #3919 (external repo) is clean. This violates the explicit 'exactly one new file' requirement in 01-02-PLAN.md and 'exactly 3 files' requirement in 01-03-PLAN.md."
    artifacts:
      - path: "chore/smithery-listing (PR #101)"
        issue: "Contains 19 .planning/ files in addition to smithery.yaml. Should be smithery.yaml only."
      - path: "chore/glama-listing (PR #102)"
        issue: "Contains 19 .planning/ files in addition to glama.json. Should be glama.json only."
      - path: "chore/cursor-marketplace (PR #104)"
        issue: "Contains 19 .planning/ files in addition to the 3 intended Cursor config files."
    missing:
      - "Rebase chore/smithery-listing onto origin/master (same fix applied to PR #103)"
      - "Rebase chore/glama-listing onto origin/master"
      - "Rebase chore/cursor-marketplace onto origin/master"
      - "Force-push rebased branches to update the open PRs"
  - truth: "REQUIREMENTS.md reflects completed status for CFG-05, CFG-06, PR-04, PR-05"
    status: failed
    reason: "REQUIREMENTS.md still shows CFG-05, CFG-06, PR-04, and PR-05 as unchecked ([ ]) and the traceability table marks them as Pending. The work was completed (PR #104 is open, .cursor-plugin/plugin.json and .mcp.json exist in the worktree) but the requirements tracking was not updated."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "Lines for CFG-05, CFG-06, PR-04, PR-05 use [ ] not [x]. Traceability table shows Pending for all four."
    missing:
      - "Mark CFG-05, CFG-06, PR-04, PR-05 as [x] complete in REQUIREMENTS.md checklist"
      - "Update traceability table status from Pending to Complete for all four"
---

# Phase 1: Config Files and Pull Requests — Verification Report

**Phase Goal:** All marketplace config files exist in the repo behind open PRs ready for review and merge
**Verified:** 2026-03-25T10:08:59Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Each of the 4 config-change marketplaces has a PR open with correct config files | VERIFIED | PRs #103, #101, #102, #104 all OPEN; config files substantively correct in each |
| 2 | awesome-mcp-servers PR is open against punkpeye/awesome-mcp-servers:main with replicant-mcp in Developer Tools | VERIFIED | PR #3919 OPEN; entry at line 921, between tgeselle and themesberg, correct emojis |
| 3 | All 5 PRs pass CI checks and contain only the files specified in the per-marketplace plan docs | FAILED | CI passes on all 5; but PRs #101, #102, #104 each contain 19 unrelated .planning/ files |
| 4 | Config files follow each marketplace's documented schema (validated against plan docs) | VERIFIED | All 5 config files validated below |

**Score:** 3/4 success criteria verified

### Observable Truths (derived from plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T1 | .mcp/server.json exists with valid MCP Registry schema and correct metadata | VERIFIED | name=io.github.thecombatwombat/replicant-mcp, desc=83 chars, version=1.6.0, schema URL present |
| T2 | package.json contains mcpName matching server.json name exactly | VERIFIED | mcpName=io.github.thecombatwombat/replicant-mcp, exact match confirmed |
| T3 | PR #103 open on chore/mcp-registry-listing with both file changes | VERIFIED | OPEN, 2 files: .mcp/server.json + package.json |
| T4 | smithery.yaml exists with valid YAML, stdio config, commandFunction, and projectRoot schema | VERIFIED | type=stdio, commandFunction uses replicant-mcp@latest, projectRoot in configSchema |
| T5 | glama.json exists with valid JSON, schema URL, and thecombatwombat maintainer | VERIFIED | schema=https://glama.ai/mcp/schemas/server.json, maintainers=["thecombatwombat"] |
| T6 | PR #101 open on chore/smithery-listing with smithery.yaml | FAILED | OPEN but contains 19 extra .planning/ files alongside smithery.yaml |
| T7 | PR #102 open on chore/glama-listing with glama.json | FAILED | OPEN but contains 19 extra .planning/ files alongside glama.json |
| T8 | .cursor-plugin/plugin.json exists with valid plugin manifest | VERIFIED | name, description, keywords, mcpServers=".mcp.json" all present |
| T9 | .mcp.json exists with valid MCP server config and is NOT gitignored | VERIFIED | replicant-mcp@latest in args; .mcp.json NOT found in .gitignore on cursor branch |
| T10 | .gitignore no longer ignores .mcp.json (on cursor branch) | VERIFIED | git check-ignore confirmed not ignored |
| T11 | PR #104 open on chore/cursor-marketplace with all three file changes | FAILED | OPEN but contains 19 extra .planning/ files alongside the 3 intended files |
| T12 | Fork exists at thecombatwombat/awesome-mcp-servers on GitHub | VERIFIED | https://github.com/thecombatwombat/awesome-mcp-servers confirmed |
| T13 | PR #3919 open against punkpeye/awesome-mcp-servers:main with replicant-mcp in Developer Tools | VERIFIED | PR #3919 OPEN, state=OPEN, 1 file (README.md only) |
| T14 | Entry is alphabetically placed in Developer Tools section | VERIFIED | Line 921, between tgeselle/bugsnag-mcp and themesberg/flowbite-mcp |
| T15 | Entry uses correct emoji legend symbols | VERIFIED | 📇 🏠 🍎 🪟 🐧 matching verified legend |

### Required Artifacts

| Artifact | Branch/Location | Status | Details |
|----------|----------------|--------|---------|
| `.mcp/server.json` | chore/mcp-registry-listing worktree | VERIFIED | 24 lines, valid JSON, schema-compliant |
| `package.json` (mcpName) | chore/mcp-registry-listing worktree | VERIFIED | mcpName=io.github.thecombatwombat/replicant-mcp |
| `smithery.yaml` | chore/smithery-listing worktree | VERIFIED | Valid YAML, stdio type, replicant-mcp@latest |
| `glama.json` | chore/glama-listing worktree | VERIFIED | Valid JSON, schema URL, thecombatwombat maintainer |
| `.cursor-plugin/plugin.json` | chore/cursor-marketplace worktree | VERIFIED | mcpServers=".mcp.json", all required fields |
| `.mcp.json` | chore/cursor-marketplace worktree | VERIFIED | replicant-mcp@latest, env={} |
| `.gitignore` (modified) | chore/cursor-marketplace worktree | VERIFIED | .mcp.json line removed |
| `README.md` (awesome-mcp-servers fork) | punkpeye/awesome-mcp-servers PR #3919 | VERIFIED | Entry at line 921, correct format |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| .mcp/server.json | package.json | mcpName must match server.json name | WIRED | Both = io.github.thecombatwombat/replicant-mcp |
| smithery.yaml commandFunction | npm:replicant-mcp | replicant-mcp@latest reference | WIRED | args=['-y', 'replicant-mcp@latest'] confirmed |
| .cursor-plugin/plugin.json | .mcp.json | mcpServers field references .mcp.json | WIRED | plugin.json.mcpServers = ".mcp.json" confirmed |
| .mcp.json | npm:replicant-mcp | command runs npx replicant-mcp@latest | WIRED | args=["-y", "replicant-mcp@latest"] confirmed |
| README.md entry | https://github.com/thecombatwombat/replicant-mcp | markdown link in entry | WIRED | [thecombatwombat/replicant-mcp](url) confirmed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CFG-01 | 01-01-PLAN.md | .mcp/server.json with valid MCP Registry schema | SATISFIED | File exists, valid schema, 83-char description |
| CFG-02 | 01-01-PLAN.md | mcpName in package.json matching registry name | SATISFIED | mcpName matches server.json name exactly |
| CFG-03 | 01-02-PLAN.md | smithery.yaml with stdio config and commandFunction | SATISFIED | File exists, valid YAML, correct structure |
| CFG-04 | 01-02-PLAN.md | glama.json with schema URL and maintainer | SATISFIED | File exists, valid JSON, correct content |
| CFG-05 | 01-03-PLAN.md | .cursor-plugin/plugin.json created | SATISFIED (stale tracking) | File exists in worktree, PR #104 open; REQUIREMENTS.md not updated |
| CFG-06 | 01-03-PLAN.md | .mcp.json created with MCP server config | SATISFIED (stale tracking) | File exists in worktree; REQUIREMENTS.md not updated |
| PR-01 | 01-01-PLAN.md | PR for MCP Registry config | SATISFIED | PR #103 OPEN, clean (2 files only) |
| PR-02 | 01-02-PLAN.md | PR for Smithery config | PARTIALLY SATISFIED | PR #101 OPEN but contains 19 extra .planning/ files |
| PR-03 | 01-02-PLAN.md | PR for Glama config | PARTIALLY SATISFIED | PR #102 OPEN but contains 19 extra .planning/ files |
| PR-04 | 01-03-PLAN.md | PR for Cursor config | PARTIALLY SATISFIED (stale tracking) | PR #104 OPEN but contains 19 extra .planning/ files; REQUIREMENTS.md not updated |
| PR-05 | 01-04-PLAN.md | PR to awesome-mcp-servers | SATISFIED (stale tracking) | PR #3919 OPEN, clean (1 file only); REQUIREMENTS.md not updated |

**Orphaned requirements check:** REQUIREMENTS.md maps CFG-01 through PR-05 (all 11 IDs) to Phase 1 — all accounted for in plans. No orphaned requirements.

**REQUIREMENTS.md staleness:** CFG-05, CFG-06, PR-04, PR-05 show [ ] (Pending) in both the checklist and traceability table despite being completed. This is a documentation gap, not an implementation gap.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| chore/smithery-listing (PR #101) | 19 unrelated .planning/ files included in PR diff | Blocker | PR cannot be cleanly reviewed or merged as intended; reviewer sees 3000+ lines of unrelated planning docs |
| chore/glama-listing (PR #102) | 19 unrelated .planning/ files included in PR diff | Blocker | Same as above |
| chore/cursor-marketplace (PR #104) | 19 unrelated .planning/ files included in PR diff | Blocker | Same as above; plan required exactly 3 files |
| .planning/REQUIREMENTS.md | CFG-05, CFG-06, PR-04, PR-05 marked Pending despite completion | Warning | Misleading project state; traceability table inaccurate |

**Root cause:** PRs #101, #102, and #104 were created from worktree branches that diverged from local master (which was ahead of origin/master by planning doc commits). The rebase-onto-origin/master fix that was applied to PR #103 was not applied to the other three branches. This is the same issue documented in the 01-01-SUMMARY deviations, but only resolved for that one plan.

### Human Verification Required

None — all automated checks are conclusive.

## Gaps Summary

Two gaps block full goal achievement:

**Gap 1 (Blocker): PRs #101, #102, #104 contain unintended .planning/ files.**
PRs for Smithery, Glama, and Cursor each include 19 unrelated `.planning/` files (PROJECT.md, ROADMAP.md, REQUIREMENTS.md, STATE.md, codebase docs, and phase plans) that belong on master but not in these marketplace PRs. The fix is the same rebase operation documented in the 01-01 summary: `git rebase --onto origin/master master <branch>` then force-push. PR #103 (MCP Registry) demonstrates the correct end state.

**Gap 2 (Warning): REQUIREMENTS.md not updated for completed Cursor and awesome-mcp-servers work.**
Four requirement IDs (CFG-05, CFG-06, PR-04, PR-05) remain marked as Pending in both the checklist and traceability table. The implementation is complete — the artifacts exist and the PRs are open — but the requirements file was not updated to reflect this.

Config file content is correct across all 5 marketplaces. CI passes on all 4 replicant-mcp PRs. The external awesome-mcp-servers PR (#3919) is clean and correct.

---

_Verified: 2026-03-25T10:08:59Z_
_Verifier: Claude (gsd-verifier)_
