---
phase: 03-registry-publishing
plan: 01
subsystem: infra
tags: [mcp-registry, npm, mcp-publisher, publishing]

requires:
  - phase: 01-config-files-and-pull-requests
    provides: ".mcp/server.json with MCP Registry manifest and mcpName in package.json"
provides:
  - "replicant-mcp listed on MCP Registry at registry.modelcontextprotocol.io"
  - "npm v1.6.1 published with mcpName field"
affects: [04-verification-and-listing-quality]

tech-stack:
  added: [mcp-publisher]
  patterns: [mcp-registry-publishing]

key-files:
  created: []
  modified: [package.json, package-lock.json, .mcp/server.json, manifest.json]

key-decisions:
  - "mcp-publisher requires server.json path argument — default ./server.json doesn't match our .mcp/server.json location"
  - "Patch release v1.6.1 used to get mcpName onto npm — no functional code changes, just metadata"

patterns-established:
  - "MCP Registry publish: mcp-publisher publish .mcp/server.json (must specify path)"

requirements-completed: [PUB-01]

duration: ~15min
completed: 2026-03-26
---

# Phase 3, Plan 01: MCP Registry Publishing Summary

**replicant-mcp v1.6.1 published to MCP Registry via mcp-publisher CLI with GitHub OAuth authentication**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 4 (package.json, package-lock.json, .mcp/server.json, manifest.json)

## Accomplishments
- Published npm v1.6.1 with mcpName field (was missing from v1.6.0)
- Authenticated mcp-publisher via GitHub OAuth device code flow
- Published to MCP Registry — listing confirmed active via API query
- Registry listing shows correct name, version, npm package, and stdio transport

## Task Commits

1. **Task 1: npm release** - `f11ee15` (chore: release v1.6.1) — release script handled version bump, server.json sync, manifest.json sync, build, tag, push
2. **Task 2: MCP Registry publish** - No file commit (external service action: mcp-publisher publish)

## Files Created/Modified
- `package.json` - Version bumped 1.6.0 → 1.6.1
- `package-lock.json` - Version sync
- `.mcp/server.json` - Version synced to 1.6.1 (by release script)
- `manifest.json` - Version synced to 1.6.1 (by release script)

## Decisions Made
- Used `mcp-publisher publish .mcp/server.json` with explicit path (default looks for `./server.json`)
- `--dry-run` flag not supported by publish command; used `validate` subcommand for pre-flight check instead
- Patch release (not minor) since only metadata change (mcpName field)

## Deviations from Plan

### Auto-fixed Issues

**1. mcp-publisher path argument required**
- **Found during:** Task 2 (publish)
- **Issue:** `mcp-publisher publish` defaults to `./server.json`, but project uses `.mcp/server.json`
- **Fix:** Pass explicit path: `mcp-publisher publish .mcp/server.json`
- **Verification:** validate + publish both succeeded with path argument

**2. --dry-run flag not supported**
- **Found during:** Task 2 (dry-run step)
- **Issue:** `mcp-publisher publish --dry-run` not a valid flag
- **Fix:** Used `mcp-publisher validate .mcp/server.json` for pre-flight validation instead
- **Verification:** validate returned "server.json is valid"

---

**Total deviations:** 2 auto-fixed (CLI behavior differences from research)
**Impact on plan:** Minor — both resolved immediately with alternative approaches

## Issues Encountered
None beyond the deviations above.

## Next Phase Readiness
- MCP Registry listing is live and queryable
- Ready for Phase 4 verification (VER-06 listing quality check)

---
*Phase: 03-registry-publishing*
*Completed: 2026-03-26*
