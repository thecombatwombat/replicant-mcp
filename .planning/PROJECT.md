# Marketplace Distribution for replicant-mcp

## What This Is

Get replicant-mcp listed on all 7 viable MCP marketplaces for maximum discoverability, credibility, and frictionless install. This covers code changes (config files), external form submissions, CLI publishing, and verification across all target marketplaces.

## Core Value

Every marketplace listing reached is a new install surface — the goal is to be findable wherever developers look for MCP servers.

## Requirements

### Validated

<!-- replicant-mcp is already a published, working product -->

- ✓ Published to npm as `replicant-mcp` v1.6.0 — existing
- ✓ MIT licensed, public GitHub repo (thecombatwombat/replicant-mcp) — existing
- ✓ stdio transport with 14 tools across 6 categories — existing
- ✓ Works as a Claude Code plugin via direct install — existing
- ✓ README with clear setup and usage documentation — existing

### Active

- [ ] Listed on Official MCP Registry (registry.modelcontextprotocol.io)
- [ ] Listed on Smithery (smithery.ai)
- [ ] Listed on Glama (glama.ai)
- [ ] Listed on awesome-mcp-servers (punkpeye/awesome-mcp-servers + mcpservers.org)
- [ ] Listed on Anthropic Connectors Directory (Claude.ai)
- [ ] Listed on Cursor Marketplace (cursor.com/marketplace)
- [ ] Listed in Claude Code Plugin Directory (official Anthropic directory)

### Out of Scope

- Windsurf marketplace — closed/curated, no public submission process
- mcp.run — requires WebAssembly rewrite, not feasible for stdio server
- HTTP/SSE transport support — replicant-mcp requires local adb/emulator/Android SDK
- New features or tools — this is distribution only, not product development
- Logo/branding redesign — use existing assets

## Context

- Detailed per-marketplace plans already exist at `docs/plans/2026-03-13-marketplace-*.md` (8 files)
- The design doc (`marketplace-distribution-design.md`) defines a 4-phase execution strategy
- Phase 1 (code changes) is parallelizable across worktrees — 4 marketplaces need repo config files
- Phase 2 (form submissions) requires manual user action for Anthropic Connectors and Claude Code Plugins
- Phase 3 (CLI publishing) is sequential and requires merged PRs + npm publish
- Phase 4 (verification) confirms all listings are live
- replicant-mcp would be the first Android-focused MCP server on awesome-mcp-servers

## Constraints

- **Transport**: stdio only — cannot change to HTTP/SSE (requires local Android SDK)
- **PR workflow**: Never push directly to master; all changes go through branches + PRs per CLAUDE.md
- **External dependencies**: Anthropic Connectors and Claude Code Plugin Directory have no SLA on review time
- **Sequential dependency**: Phase 3 publishing requires Phase 1 PRs to be merged and on master/npm first
- **Manual steps**: Google Form (Anthropic) and web form (Claude Code Plugins) require user to submit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Parallel worktree execution for Phase 1 | All 4 code-change marketplaces are independent | — Pending |
| Full lifecycle (PRs → merge → publish → verify) | User wants listings actually live, not just PRs | — Pending |
| All 7 marketplaces targeted | No changes since original plan on 2026-03-13 | — Pending |

---
*Last updated: 2026-03-25 after initialization*
