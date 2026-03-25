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
- [ ] **CFG-05**: `.cursor-plugin/plugin.json` created with plugin manifest
- [ ] **CFG-06**: `.mcp.json` created with MCP server config for Cursor

### Pull Requests (per project rules — never push to master)

- [x] **PR-01**: PR for MCP Registry config (`chore/mcp-registry-listing`)
- [x] **PR-02**: PR for Smithery config (`chore/smithery-listing`)
- [x] **PR-03**: PR for Glama config (`chore/glama-listing`)
- [ ] **PR-04**: PR for Cursor config (`chore/cursor-marketplace`)
- [ ] **PR-05**: PR to awesome-mcp-servers adding replicant-mcp to Developer Tools section

### Form Submissions (manual user action, content prepared by Claude)

- [ ] **FORM-01**: Anthropic Connectors Google Form answers prepared with description, prompts, and safety notes
- [ ] **FORM-02**: Claude Code Plugin Directory form answers prepared with description, features, and example prompts

### Publishing (post-merge CLI/web actions)

- [ ] **PUB-01**: MCP Registry published via `mcp-publisher publish`
- [ ] **PUB-02**: Smithery submitted via web (smithery.ai/new) or CLI
- [ ] **PUB-03**: Glama ownership claimed on glama.ai with GitHub auth
- [ ] **PUB-04**: Cursor plugin submitted at cursor.com/marketplace/publish

### Verification (confirm listings are live)

- [ ] **VER-01**: MCP Registry listing returns correct metadata via API query
- [ ] **VER-02**: Smithery listing appears in search with accurate description
- [ ] **VER-03**: Glama listing shows at expected URL with correct tool list
- [ ] **VER-04**: awesome-mcp-servers entry visible on GitHub and mcpservers.org
- [ ] **VER-05**: Anthropic Connectors form submitted (review timing is external)
- [ ] **VER-06**: Claude Code Plugin Directory form submitted (review timing is external)
- [ ] **VER-07**: Cursor plugin submitted for review (review timing is external)

## v2 Requirements

Deferred to future. Not in current roadmap.

- **REL-01**: Automate version sync in `.mcp/server.json` during `/release`
- **REL-02**: Add `mcp-publisher publish` to release script
- **CURSOR-01**: Add Cursor-specific skills, rules, or agents to plugin
- **BRAND-01**: Create logo/icon for marketplace listings

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
| CFG-05 | Phase 1 | Pending |
| CFG-06 | Phase 1 | Pending |
| PR-01 | Phase 1 | Complete |
| PR-02 | Phase 1 | Complete |
| PR-03 | Phase 1 | Complete |
| PR-04 | Phase 1 | Pending |
| PR-05 | Phase 1 | Pending |
| FORM-01 | Phase 2 | Pending |
| FORM-02 | Phase 2 | Pending |
| PUB-01 | Phase 3 | Pending |
| PUB-02 | Phase 3 | Pending |
| PUB-03 | Phase 3 | Pending |
| PUB-04 | Phase 3 | Pending |
| VER-01 | Phase 4 | Pending |
| VER-02 | Phase 4 | Pending |
| VER-03 | Phase 4 | Pending |
| VER-04 | Phase 4 | Pending |
| VER-05 | Phase 4 | Pending |
| VER-06 | Phase 4 | Pending |
| VER-07 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after initial definition*
