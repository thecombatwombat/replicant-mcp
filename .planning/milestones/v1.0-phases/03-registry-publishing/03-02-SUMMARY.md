---
phase: 03-registry-publishing
plan: 02
subsystem: infra
tags: [smithery, glama, cursor, marketplace, publishing]

requires:
  - phase: 01-config-files-and-pull-requests
    provides: "smithery.yaml, glama.json, .cursor-plugin/plugin.json on master"
provides:
  - "Smithery listing at smithery.ai/servers/replicant-co/replicant-mcp"
  - "Glama listing confirmed live at glama.ai/mcp/servers/thecombatwombat/replicant-mcp"
  - "Cursor marketplace plugin application submitted"
affects: [04-verification-and-listing-quality]

tech-stack:
  added: ["@smithery/cli"]
  patterns: [smithery-cli-publishing, cursor-marketplace-submission]

key-files:
  created: []
  modified: []

key-decisions:
  - "Used replicant-co namespace on Smithery (not thecombatwombat) for brand consistency"
  - "Smithery web UI requires HTTP servers — used CLI publish for stdio server instead"
  - "Cursor submission is application-based with manual review, no SLA on listing"
  - "Created replicant-mcp logo (assets/logo.svg) for Cursor marketplace application"

patterns-established:
  - "Smithery publish for stdio servers: npx @smithery/cli mcp publish <repo-url> -n <namespace>/<name>"

requirements-completed: [PUB-02, PUB-03, PUB-04]

duration: ~20min
completed: 2026-03-26
---

# Phase 3, Plan 02: Smithery/Cursor/Glama Summary

**Smithery published via CLI as replicant-co/replicant-mcp, Glama confirmed live, Cursor plugin application submitted with custom logo**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 1 (assets/logo.svg created for Cursor application)

## Accomplishments
- Confirmed Glama listing live at glama.ai (HTTP 200, auto-indexed from Phase 1)
- Published to Smithery as replicant-co/replicant-mcp via CLI (web UI only supports HTTP servers)
- Created replicant-co namespace on Smithery
- Designed and committed friendly connector-droid logo (assets/logo.svg)
- Submitted Cursor marketplace plugin application with all fields filled

## Task Commits

1. **Task 1: Confirm Glama listing** - No commit (verification-only, HTTP 200 confirmed)
2. **Task 2: Smithery + Cursor submissions** - No code commit (external service actions + browser submission)

## Files Created/Modified
- `assets/logo.svg` - Friendly connector-droid logo for marketplace listings

## Decisions Made
- Smithery namespace: replicant-co (brand-themed, not GitHub username)
- Smithery web UI only accepts HTTP server URLs now; used CLI publish as fallback for stdio server
- Created custom SVG logo rather than using GitHub avatar for Cursor application

## Deviations from Plan

### Auto-fixed Issues

**1. Smithery web UI no longer supports GitHub repo submissions for stdio servers**
- **Found during:** Task 2 (Smithery submission)
- **Issue:** smithery.ai/new only accepts HTTP server URLs, not GitHub repos
- **Fix:** Used Smithery CLI: `npx @smithery/cli mcp publish <repo-url> -n replicant-co/replicant-mcp`
- **Verification:** CLI returned success, release ID accepted

---

**Total deviations:** 1 auto-fixed (platform evolution)
**Impact on plan:** Minor — CLI fallback was already documented in research

## Issues Encountered
None beyond the Smithery web UI deviation above.

## Next Phase Readiness
- All four marketplace submissions complete (PUB-01 through PUB-04)
- Cursor listing pending manual review (no SLA)
- Ready for Phase 4 verification of listing quality

---
*Phase: 03-registry-publishing*
*Completed: 2026-03-26*
