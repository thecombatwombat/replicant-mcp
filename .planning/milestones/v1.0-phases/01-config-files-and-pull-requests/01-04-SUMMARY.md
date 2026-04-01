---
phase: 01-config-files-and-pull-requests
plan: 04
subsystem: infra
tags: [awesome-list, marketplace, community]

requires:
  - phase: none
    provides: none
provides:
  - replicant-mcp entry in awesome-mcp-servers (84k+ stars community list)
affects: [marketplace-distribution, visibility]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - "README.md (in punkpeye/awesome-mcp-servers fork)"

key-decisions:
  - "Used correct emoji legend: 📇 🏠 🍎 🪟 🐧"
  - "Placed alphabetically between tgeselle and themesberg in Developer Tools section"

patterns-established: []

requirements-completed: [PR-05]

duration: 5min
completed: 2026-03-25
---

# Plan 01-04: awesome-mcp-servers Entry Summary

**First Android MCP server entry added to awesome-mcp-servers (84k+ stars) Developer Tools section**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 1 (README.md in external fork)

## Accomplishments
- Forked punkpeye/awesome-mcp-servers to thecombatwombat/awesome-mcp-servers
- Added replicant-mcp entry in Developer Tools section, alphabetically positioned
- Entry uses verified emoji legend: 📇 (TypeScript), 🏠 (local), 🍎 (macOS), 🪟 (Windows), 🐧 (Linux)
- PR #3919 opened against punkpeye/awesome-mcp-servers:main

## Task Commits

1. **Task 1: Fork repo and add entry** - `64d96d8` (Add replicant-mcp to Developer Tools)
2. **Task 2: Open upstream PR** - PR #3919 created

## Files Created/Modified
- `README.md` (in awesome-mcp-servers fork) - Added replicant-mcp entry at line 921

## Decisions Made
- Followed awesome-mcp-servers commit convention ("Add X" format, not conventional commits)
- Verified emoji legend still matches plan's symbols before adding entry

## Deviations from Plan
None - plan executed as written. Sandbox restrictions on /tmp/ required orchestrator to complete file operations.

## Issues Encountered
- Executor agent blocked by sandbox restrictions (can't access /tmp/). Orchestrator completed the work directly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 plans complete, all PRs open
- Phase ready for verification

---
*Phase: 01-config-files-and-pull-requests*
*Completed: 2026-03-25*
