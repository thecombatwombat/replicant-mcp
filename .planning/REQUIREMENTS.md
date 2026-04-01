# Requirements: Marketplace Distribution for replicant-mcp

**Defined:** 2026-03-25
**Core Value:** Every marketplace listing reached is a new install surface — be findable wherever developers look for MCP servers.

## v1 Requirements

Requirements for full marketplace distribution. Each maps to roadmap phases.

### Config Files (code changes to repo)

- [x] **CFG-01**: `.mcp/server.json` created with valid MCP Registry schema and correct metadata
- [x] **CFG-02**: `mcpName` field added to `package.json` matching registry name
- [x] **CFG-03**: `smithery.yaml` created with stdio config, commandFunction, and optional projectRoot schema
- [x] **CFG-04**: `glama.json` created with schema URL and maintainer
- [x] **CFG-05**: `.cursor-plugin/plugin.json` created with plugin manifest
- [x] **CFG-06**: `.mcp.json` created with MCP server config for Cursor

### Pull Requests (per project rules — never push to master)

- [x] **PR-01**: PR for MCP Registry config (`chore/mcp-registry-listing`)
- [x] **PR-02**: PR for Smithery config (`chore/smithery-listing`)
- [x] **PR-03**: PR for Glama config (`chore/glama-listing`)
- [x] **PR-04**: PR for Cursor config (`chore/cursor-marketplace`)
- [x] **PR-05**: PR to awesome-mcp-servers adding replicant-mcp to Developer Tools section

### Form Submissions (manual user action, content prepared by Claude)

- [x] **FORM-01**: MCPB Desktop Extensions form submitted with .mcpb bundle and description
- [ ] ~~**FORM-02**: Claude Code Plugin Directory~~ — Deferred (requires building a Claude Code plugin, not just a form)

### Publishing (post-merge CLI/web actions)

- [x] **PUB-01**: MCP Registry published via `mcp-publisher publish`
- [x] **PUB-02**: Smithery submitted via web (smithery.ai/new) or CLI
- [x] **PUB-03**: Glama ownership claimed on glama.ai with GitHub auth
- [x] **PUB-04**: Cursor plugin submitted at cursor.com/marketplace/publish

### Verification (confirm listings are live)

- [x] **VER-01**: MCP Registry listing returns correct metadata via API query
- [x] **VER-02**: Smithery listing appears in search with accurate description -- PARTIAL PASS: listing exists at smithery.ai but is unlisted (no description, no capabilities, not in search)
- [x] **VER-03**: Glama listing shows at expected URL with correct tool list
- [x] **VER-04**: awesome-mcp-servers entry visible on GitHub and mcpservers.org -- BLOCKED: upstream repo punkpeye/awesome-mcp-servers deleted (404), PR #3919 dead, needs re-submission to successor repo
- [x] **VER-05**: Anthropic Connectors form submitted (review timing is external) -- form submitted, review external
- [ ] ~~**VER-06**: Claude Code Plugin Directory form submitted~~ -- Deferred (FORM-02 deferred to v2)
- [x] **VER-07**: Cursor plugin submitted for review (review timing is external) -- submitted, review external

## v2 Requirements

Deferred to future. Not in current roadmap.

- **REL-01**: Automate version sync in `.mcp/server.json` during `/release`
- **REL-02**: Add `mcp-publisher publish` to release script
- **CURSOR-01**: Add Cursor-specific skills, rules, or agents to plugin
- **PLUGIN-01**: Package replicant-mcp as Claude Code plugin and submit to Plugin Directory (FORM-02)
- **BRAND-01**: Create logo/icon for marketplace listings
- **SMITH-01**: Configure Smithery dashboard — add description, capabilities, and make listing visible in search (currently unlisted at smithery.ai/@replicant-co/replicant-mcp)
- **AWESOME-01**: Re-submit to awesome-mcp-servers successor repo (appcypher/awesome-mcp-servers ~5.3k stars or wong2/awesome-mcp-servers ~3.8k stars) — original punkpeye repo deleted

## Out of Scope

| Feature | Reason |
|---------|--------|
| Windsurf marketplace | Closed/curated, no public submission process |
| mcp.run | Requires WebAssembly rewrite, not feasible for stdio server |
| HTTP/SSE transport | replicant-mcp requires local Android SDK access |
| New tools or features | This is distribution only, not product development |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CFG-01 | Phase 1 | Complete |
| CFG-02 | Phase 1 | Complete |
| CFG-03 | Phase 1 | Complete |
| CFG-04 | Phase 1 | Complete |
| CFG-05 | Phase 1 | Complete |
| CFG-06 | Phase 1 | Complete |
| PR-01 | Phase 1 | Complete |
| PR-02 | Phase 1 | Complete |
| PR-03 | Phase 1 | Complete |
| PR-04 | Phase 1 | Complete |
| PR-05 | Phase 1 | Complete |
| FORM-01 | Phase 2 | Complete (verified retroactively in Phase 5) |
| FORM-02 | Phase 2 | Deferred to v2 |
| PUB-01 | Phase 3 | Complete |
| PUB-02 | Phase 3 | Complete |
| PUB-03 | Phase 3 | Complete |
| PUB-04 | Phase 3 | Complete |
| VER-01 | Phase 4 | Complete (PASS -- API verified) |
| VER-02 | Phase 4 | Partial Pass (listing exists, unlisted/unconfigured) |
| VER-03 | Phase 4 | Complete (PASS -- HTTP 200) |
| VER-04 | Phase 4 | Blocked (upstream repo deleted, PR dead) |
| VER-05 | Phase 4 | Complete (form submitted, review external) |
| VER-06 | Phase 4 | Deferred to v2 (FORM-02 deferred) |
| VER-07 | Phase 4 | Complete (submitted, review external) |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓
- Unsatisfied (audit): 0 (FORM-01 verified retroactively in Phase 5)

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-04-01 after milestone audit gap closure planning (FORM-01 reassigned to Phase 5, SMITH-01 and AWESOME-01 added to v2)*
