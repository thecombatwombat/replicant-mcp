# Marketplace Distribution for replicant-mcp

## What This Is

replicant-mcp is listed across 6 MCP marketplaces for maximum discoverability. Config files, form submissions, CLI publishing, and verification are complete. The server is live on MCP Registry and Glama, submitted to Anthropic Connectors and Cursor (pending external review), and published on Smithery (needs dashboard configuration for search visibility).

## Core Value

Every marketplace listing reached is a new install surface — be findable wherever developers look for MCP servers.

## Requirements

### Validated

- ✓ Published to npm as `replicant-mcp` v1.6.1 — v1.0
- ✓ MIT licensed, public GitHub repo (thecombatwombat/replicant-mcp) — existing
- ✓ stdio transport with 14 tools across 6 categories — existing
- ✓ Works as a Claude Code plugin via direct install — existing
- ✓ README with clear setup and usage documentation — existing
- ✓ Listed on Official MCP Registry — v1.0 (API-verified active)
- ✓ Listed on Glama — v1.0 (HTTP 200 confirmed)
- ✓ Listed on Smithery — v1.0 (published, needs dashboard config for visibility)
- ✓ Submitted to Anthropic Connectors Directory — v1.0 (MCPB form submitted, pending review)
- ✓ Submitted to Cursor Marketplace — v1.0 (submitted with logo, pending review)
- ✓ awesome-mcp-servers PR opened — v1.0 (upstream repo later deleted)

### Active

- [ ] Configure Smithery dashboard for search visibility (SMITH-01)
- [ ] Re-submit to awesome-mcp-servers successor repo (AWESOME-01)
- [ ] Package as Claude Code plugin and submit to Plugin Directory (PLUGIN-01)
- [ ] Create logo/icon for marketplace listings (BRAND-01)
- [ ] Automate version sync in `.mcp/server.json` during release (REL-01)
- [ ] Add `mcp-publisher publish` to release script (REL-02)

### Out of Scope

- Windsurf marketplace — closed/curated, no public submission process
- mcp.run — requires WebAssembly rewrite, not feasible for stdio server
- HTTP/SSE transport support — replicant-mcp requires local adb/emulator/Android SDK

## Context

Shipped v1.0 marketplace distribution in 7 days (2026-03-25 → 2026-04-01). 5 phases, 9 plans, 34 commits, 59 files modified. Tech stack: TypeScript MCP server on npm, stdio transport.

Current marketplace status:
- **LIVE**: MCP Registry, Glama
- **SUBMITTED** (pending review): Anthropic Connectors (MCPB), Cursor
- **NEEDS CONFIG**: Smithery (published but unlisted)
- **BLOCKED**: awesome-mcp-servers (upstream repo deleted)
- **DEFERRED**: Claude Code Plugin Directory (requires building a plugin)

## Constraints

- **Transport**: stdio only — cannot change to HTTP/SSE (requires local Android SDK)
- **PR workflow**: Never push directly to master; all changes go through branches + PRs per CLAUDE.md
- **External dependencies**: Anthropic Connectors and Cursor have no SLA on review time

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Parallel worktree execution for Phase 1 | All 4 code-change marketplaces are independent | ✓ Good — 4 PRs created efficiently |
| Full lifecycle (PRs → merge → publish → verify) | User wants listings actually live, not just PRs | ✓ Good — 4/7 confirmed live |
| All 7 marketplaces targeted | No changes since original plan on 2026-03-13 | ⚠️ Revisit — awesome-mcp-servers repo deleted, Claude Code Plugin requires more work than expected |
| Defer FORM-02 to v2 | Claude Code Plugin Directory requires building a full plugin, not just a form | ✓ Good — correctly scoped |
| Retroactive Phase 2 verification in Phase 5 | Milestone audit found FORM-01 orphaned (missing VERIFICATION.md) | ✓ Good — closed procedural gap |
| Release script .cursor-plugin sync | Audit found version drift between plugin.json and other version files | ✓ Good — prevents future drift |

---
*Last updated: 2026-04-01 after v1.0 milestone*
