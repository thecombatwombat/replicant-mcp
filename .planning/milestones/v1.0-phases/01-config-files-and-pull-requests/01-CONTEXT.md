# Phase 1: Config Files and Pull Requests - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add marketplace config files to the replicant-mcp repo and open 5 PRs: 4 internal (MCP Registry, Smithery, Glama, Cursor) and 1 external fork (awesome-mcp-servers). Each PR contains only the config files specified in the per-marketplace plan docs at `docs/plans/2026-03-13-marketplace-*.md`.

</domain>

<decisions>
## Implementation Decisions

### Version pinning
- Use `@latest` for npx commands in Smithery, Cursor, and any install-time references — users always get newest
- MCP Registry `server.json` version field: set to `1.6.0` (current) — will be automated in v2 (REL-01)
- MCP Registry `packages[].version`: set to `1.6.0` — same manual update policy

### Description text
- Claude's discretion on tailoring vs unifying descriptions per platform
- Use the existing descriptions from plan docs as the baseline
- No specific language mandates — plans already have good copy

### PR execution
- All 5 PRs created in parallel via worktrees (decided during project init)
- Branch names per plan docs: `chore/mcp-registry-listing`, `chore/smithery-listing`, `chore/glama-listing`, `chore/cursor-marketplace`
- awesome-mcp-servers: fork + branch `add-replicant-mcp` on external repo

### Claude's Discretion
- Whether to unify descriptions across marketplaces or tailor per audience
- Exact wording adjustments within existing plan doc templates
- awesome-mcp-servers emoji selection (verify against current legend)
- PR merge order (no dependency between the 5 PRs)

</decisions>

<specifics>
## Specific Ideas

No specific requirements beyond what's in the plan docs. The per-marketplace plans at `docs/plans/2026-03-13-marketplace-*.md` contain exact file contents, schemas, and checkpoint validations.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json`: Already published as `replicant-mcp` v1.6.0 with correct name, description, bin entry, and MIT license
- `README.md`: Existing documentation with setup instructions and feature list
- `src/server.ts`: Tool definitions with descriptions (needed for Anthropic Connectors safety review, Phase 2)

### Established Patterns
- All changes go through branches + PRs per CLAUDE.md rules
- Conventional commits: `chore:` prefix for config/tooling changes
- No marketplace config files exist yet — clean starting point

### Integration Points
- `package.json` needs `mcpName` field added (MCP Registry requirement)
- No other existing files need modification — all config files are new additions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-config-files-and-pull-requests*
*Context gathered: 2026-03-25*
