# Phase 3: Registry Publishing - Research

**Researched:** 2026-03-26
**Domain:** CLI/web publishing to MCP Registry, Smithery, Glama, and Cursor Marketplace
**Confidence:** HIGH

## Summary

Phase 3 publishes replicant-mcp to four marketplaces that require post-merge CLI or web actions: MCP Registry, Smithery, Glama, and Cursor. All Phase 1 PRs are merged (as of 2026-03-25), so config files are on master. However, the published npm package (v1.6.0, published 2026-03-13) does NOT include the `mcpName` field added by PR-103. This is a critical blocker for PUB-01 (MCP Registry) -- a new npm version must be published first, or `mcp-publisher publish` will fail with "Registry validation failed for package."

A major discovery during research: PUB-03 (Glama) is already complete. Glama auto-indexed replicant-mcp and the listing at `glama.ai/mcp/servers/thecombatwombat/replicant-mcp` shows it as "author:claimed" with 12 tools listed. The `glama.json` file on master was sufficient -- no additional web action is needed. For PUB-02 (Smithery), the platform has evolved significantly since the original plan was written; the current primary publishing flow is URL-based for HTTP servers, but GitHub repo connection with `smithery.yaml` still works for stdio servers via smithery.ai/new. For PUB-04 (Cursor), the marketplace accepts community submissions at `cursor.com/marketplace/publish` where you enter a GitHub repo URL; all plugins are manually reviewed before listing.

**Primary recommendation:** Start with an npm version bump/publish to include `mcpName`, then execute MCP Registry, Smithery, and Cursor sequentially. Skip Glama (already done). The user must perform the Cursor submission manually via a web browser.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUB-01 | MCP Registry published via `mcp-publisher publish` | BLOCKER: Requires `mcpName` in published npm package. Current v1.6.0 does not have it. Must `npm publish` a new version first. Then install `mcp-publisher` via `brew install mcp-publisher`, login via `mcp-publisher login github` (device code flow), dry-run, and publish. |
| PUB-02 | Smithery submitted via web (smithery.ai/new) or CLI | Go to smithery.ai/new, sign in with GitHub, enter repo URL `https://github.com/thecombatwombat/replicant-mcp`. Smithery reads `smithery.yaml` from master. Alternatively: `smithery mcp publish <url> -n @thecombatwombat/replicant-mcp` via CLI. Web is simpler for a one-time action. |
| PUB-03 | Glama ownership claimed on glama.ai with GitHub auth | ALREADY COMPLETE. Glama auto-indexed and shows replicant-mcp as "author:claimed" at `glama.ai/mcp/servers/thecombatwombat/replicant-mcp` with 12 tools. No action needed. |
| PUB-04 | Cursor plugin submitted at cursor.com/marketplace/publish | Submit GitHub repo URL at cursor.com/marketplace/publish. Cursor reads `.cursor-plugin/plugin.json` from the repo. All plugins are manually reviewed before listing (no SLA on review time). User must do this in a browser. |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `mcp-publisher` | latest (via Homebrew) | Publish to MCP Registry | Official CLI from modelcontextprotocol/registry |
| `npm` | installed | Publish new version with `mcpName` | Required prerequisite for MCP Registry |
| `brew` | installed | Install `mcp-publisher` | Recommended install method per official docs |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `curl` + `jq` | Verify MCP Registry publish result | After `mcp-publisher publish` to confirm listing |
| Web browser | Smithery and Cursor submissions | smithery.ai/new and cursor.com/marketplace/publish |
| `gh` CLI | Authenticated GitHub operations if needed | Already authenticated as `thecombatwombat` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `brew install mcp-publisher` | curl binary install | Brew is simpler, binary install works if brew unavailable |
| Smithery web (smithery.ai/new) | `smithery mcp publish` CLI | Web is simpler for one-time action; CLI requires installing @smithery/cli |
| npm version bump + publish | Manual package.json edit | Use project's existing `npm run release` script to follow established workflow |

## Architecture Patterns

### Execution Order (Sequential)
```
1. npm publish (new version with mcpName)  -- PREREQUISITE
   |
2. mcp-publisher install + login + publish  -- PUB-01
   |
3. Smithery web submission                  -- PUB-02
   |
4. Cursor web submission                    -- PUB-04
   |
(PUB-03 Glama -- ALREADY DONE, skip)
```

### Pattern 1: MCP Registry Publish (CLI-driven)
**What:** Install mcp-publisher, authenticate via GitHub device code flow, dry-run, publish.
**When to use:** PUB-01 only.
**Steps:**
```bash
# 1. Install
brew install mcp-publisher

# 2. Verify
mcp-publisher --help

# 3. Authenticate (opens browser for GitHub OAuth device code)
mcp-publisher login github
# Follow prompts: visit github.com/login/device, enter code

# 4. Dry run (validates server.json + npm package mcpName match)
mcp-publisher publish --dry-run

# 5. Publish
mcp-publisher publish

# 6. Verify
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp" | jq .
```
Source: [MCP Registry Quickstart](https://modelcontextprotocol.io/registry/quickstart)

### Pattern 2: Smithery Web Submission (Browser-driven)
**What:** Submit GitHub repo URL at smithery.ai/new. Smithery reads smithery.yaml from repo.
**When to use:** PUB-02.
**Steps:**
1. Go to https://smithery.ai/new
2. Sign in with GitHub (thecombatwombat account)
3. Enter repo URL: `https://github.com/thecombatwombat/replicant-mcp`
4. Smithery reads `smithery.yaml` and auto-configures
5. Review listing preview
6. Submit

### Pattern 3: Cursor Marketplace Submission (Browser-driven)
**What:** Submit GitHub repo URL at cursor.com/marketplace/publish. Cursor reads plugin.json.
**When to use:** PUB-04.
**Steps:**
1. Go to https://cursor.com/marketplace/publish
2. Submit repo URL: `https://github.com/thecombatwombat/replicant-mcp`
3. Cursor reads `.cursor-plugin/plugin.json` automatically
4. Review listing preview
5. Submit for review (manual review by Cursor team, no SLA)

### Anti-Patterns to Avoid
- **Publishing to MCP Registry before npm publish:** `mcp-publisher publish` validates that `mcpName` exists in the published npm package. It will fail if the field is missing.
- **Running `npm publish` without the release script:** The project has `npm run release` which handles version bumping, building, testing, tagging, and publishing. Never run raw `npm publish`.
- **Assuming Smithery CLI is needed:** The web flow at smithery.ai/new is simpler and sufficient. No need to install @smithery/cli globally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP Registry auth | Manual token management | `mcp-publisher login github` | Handles OAuth device flow, token storage, namespace verification |
| npm version bump | Manual package.json edit + git tag | `npm run release` (project's release script) | Handles build, test, version bump, tag, publish atomically |
| Registry validation | Manual JSON comparison | `mcp-publisher publish --dry-run` | Validates server.json against registry schema AND verifies mcpName in npm package |

**Key insight:** This phase is mostly user-driven web actions and one CLI tool. The complexity is in prerequisites (npm publish) and the correct execution order, not in building anything.

## Common Pitfalls

### Pitfall 1: mcpName Not in Published npm Package (CRITICAL)
**What goes wrong:** `mcp-publisher publish` fails with "Registry validation failed for package" because the published npm package does not contain `mcpName`.
**Why it happens:** The `mcpName` field was added to `package.json` via PR-103 (merged 2026-03-25), but the last npm publish was v1.6.0 on 2026-03-13 -- before the field was added.
**How to avoid:** Run a new npm release (e.g., v1.6.1 or v1.7.0) before attempting MCP Registry publish. Use the project's `npm run release` script.
**Warning signs:** `npm view replicant-mcp mcpName` returns empty.
**Verification:** After publish, run `npm view replicant-mcp mcpName` -- should return `io.github.thecombatwombat/replicant-mcp`.

### Pitfall 2: server.json Version Mismatch
**What goes wrong:** `server.json` says version `1.6.0` but the newly published npm version is different (e.g., `1.6.1`).
**Why it happens:** `server.json` was created during Phase 1 with hard-coded `1.6.0`. A new release changes the version.
**How to avoid:** Update `version` fields in `.mcp/server.json` (both top-level and inside `packages[0]`) to match the new npm version BEFORE running `mcp-publisher publish`. This should be part of the release workflow or done as a manual step.
**Warning signs:** `mcp-publisher publish --dry-run` may flag version mismatch.

### Pitfall 3: mcp-publisher Authentication Expired
**What goes wrong:** `mcp-publisher publish` fails with "Invalid or expired Registry JWT token."
**Why it happens:** GitHub OAuth token from `mcp-publisher login` has expired.
**How to avoid:** Re-run `mcp-publisher login github` before publishing if any time has passed since initial login.
**Warning signs:** Error message explicitly mentions expired token.

### Pitfall 4: Smithery Platform Evolution
**What goes wrong:** smithery.ai/new may have changed its submission flow since the original plan was written (2026-03-13).
**Why it happens:** Smithery has been evolving toward Streamable HTTP as the primary transport. The docs now emphasize URL-based publishing for HTTP servers. However, stdio servers with `smithery.yaml` are still supported via repo connection.
**How to avoid:** Use the web flow at smithery.ai/new with GitHub repo URL. If the flow asks for an HTTP URL instead of a GitHub repo, try the CLI alternative: `npx @smithery/cli mcp publish` or search for "repo" release type in the UI.
**Warning signs:** No option to enter a GitHub repo URL on smithery.ai/new.

### Pitfall 5: Cursor Review Timing
**What goes wrong:** Plugin submitted but not listed. User assumes something went wrong.
**Why it happens:** All Cursor plugins are manually reviewed before listing. There is no documented SLA.
**How to avoid:** Accept that submission does not equal listing. The requirement (PUB-04) is "submitted," not "listed." Listing verification is in Phase 4 (VER-07).
**Warning signs:** No confirmation email or status update after submission.

## Code Examples

### Prerequisite: npm Release with mcpName
```bash
# Verify mcpName is in local package.json (should already be there from Phase 1)
node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('mcpName:', p.mcpName)"
# Output: mcpName: io.github.thecombatwombat/replicant-mcp

# Use project release script (handles build, test, version, tag, publish)
npm run release
# This bumps patch version (e.g., 1.6.0 -> 1.6.1), builds, tests, publishes

# Verify mcpName is now in published package
npm view replicant-mcp mcpName
# Expected: io.github.thecombatwombat/replicant-mcp
```
Source: Project `package.json` scripts, release flow.

### Update server.json Version After Release
```bash
# After npm release bumps version, update server.json to match
# Example: if new version is 1.6.1
NEW_VERSION=$(node -e "console.log(require('./package.json').version)")
# Edit .mcp/server.json to update both version fields
node -e "
const fs = require('fs');
const s = JSON.parse(fs.readFileSync('.mcp/server.json','utf8'));
const v = require('./package.json').version;
s.version = v;
s.packages[0].version = v;
fs.writeFileSync('.mcp/server.json', JSON.stringify(s, null, 2) + '\n');
console.log('Updated server.json to version', v);
"
```

### MCP Registry Publish (PUB-01)
```bash
# Install mcp-publisher
brew install mcp-publisher

# Authenticate with GitHub
mcp-publisher login github
# Opens browser -> github.com/login/device -> enter code

# Dry run validation
mcp-publisher publish --dry-run
# Should complete without errors

# Publish
mcp-publisher publish
# Expected: "Successfully published" with server name

# Verify
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp" | jq '.servers[0].name'
# Expected: "io.github.thecombatwombat/replicant-mcp"
```
Source: [MCP Registry Quickstart](https://modelcontextprotocol.io/registry/quickstart)

### Verify Glama (PUB-03 -- already done)
```bash
# Confirm Glama listing exists and is claimed
curl -sL "https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp" -o /dev/null -w "%{http_code}"
# Expected: 200
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Smithery: smithery.yaml + web submit at smithery.ai/new | Smithery: URL-based for HTTP; repo connection for stdio | Mid-2025 evolution | smithery.yaml still works for stdio repos via repo connection |
| Cursor: curated partner-only | Cursor: open community submissions at cursor.com/marketplace/publish | Feb 2026 (Cursor 2.5) | Anyone can submit, still manually reviewed |
| MCP Registry: new/preview | MCP Registry: still in preview | Ongoing | Breaking changes or data resets possible |

**Deprecated/outdated:**
- The original plan doc (2026-03-13) mentions `brew install mcp-publisher` -- this is still valid per [Homebrew Formulae](https://formulae.brew.sh/formula/mcp-publisher).
- Smithery's old documentation at smithery.ai/docs/config#smitheryyaml returns 404 -- the docs have been restructured but the smithery.yaml format itself still works.

## Open Questions

1. **npm version bump scope**
   - What we know: A new npm publish is needed to include `mcpName`. The project uses `npm run release` which does a patch bump by default.
   - What's unclear: Should this be a patch (1.6.1) or is there other work to bundle? The marketplace config files (.mcp/server.json, smithery.yaml, etc.) are not included in the npm tarball (per the `files` field), so the only change in the npm package is the `mcpName` field in package.json metadata.
   - Recommendation: Do a patch release (1.6.1) with just the `mcpName` addition. Then update `server.json` versions to match.

2. **server.json version update workflow**
   - What we know: server.json has hard-coded `1.6.0`. After a new release, it must be updated to match.
   - What's unclear: Should the server.json update happen before or after `mcp-publisher publish`? Should it be committed on a branch per project rules?
   - Recommendation: Update server.json to match the new version, commit on a branch (per project rules -- never push to master directly), merge, then `mcp-publisher publish`. Alternatively, if the version sync is not validated by mcp-publisher, publish first and update server.json as part of v2 automation (REL-01).

3. **Smithery submission flow for stdio repos**
   - What we know: smithery.ai/new exists. The docs emphasize HTTP URL submission. But smithery.yaml for stdio is still referenced in CLI docs and examples.
   - What's unclear: Whether smithery.ai/new currently offers a "GitHub repo" option alongside "HTTP URL."
   - Recommendation: Try smithery.ai/new first. If it only asks for an HTTP URL, fall back to CLI: `npx @smithery/cli auth login && npx @smithery/cli mcp publish --help`. The smithery.yaml file is on master and ready.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | MCP Registry listing exists with correct metadata | smoke | `curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp" \| jq '.servers[0].name'` | N/A (external service check) |
| PUB-02 | Smithery listing exists | manual-only | Search "replicant-mcp" at smithery.ai | N/A (web UI check) |
| PUB-03 | Glama listing exists and is claimed | smoke | `curl -sL "https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp" -o /dev/null -w "%{http_code}"` | N/A (already verified as 200) |
| PUB-04 | Cursor plugin submitted | manual-only | Check cursor.com/marketplace for pending submission | N/A (web UI, no API) |

### Sampling Rate
- **Per task commit:** `npm view replicant-mcp mcpName` (verify npm publish includes mcpName)
- **Per wave merge:** `npm run test:coverage` (ensure no regressions)
- **Phase gate:** PUB-01 API query returns results, PUB-02/PUB-04 submitted (visual confirmation)

### Wave 0 Gaps
None -- this phase involves CLI tools and web submissions, not code changes requiring test infrastructure. The prerequisite npm release uses the existing test suite via `npm run release` (which runs `prepublishOnly` -> build + test).

## Sources

### Primary (HIGH confidence)
- [MCP Registry Quickstart](https://modelcontextprotocol.io/registry/quickstart) - Complete step-by-step publishing workflow, verified 2026-03-26
- [mcp-publisher Homebrew formula](https://formulae.brew.sh/formula/mcp-publisher) - Installation via `brew install mcp-publisher` confirmed
- [Cursor Plugins docs](https://cursor.com/docs/plugins) - Confirmed community submissions open, manual review, cursor.com/marketplace/publish
- [Cursor plugin-template](https://github.com/cursor/plugin-template) - Confirmed plugin.json format and submission process
- [Glama blog: What is glama.json](https://glama.ai/blog/2025-07-08-what-is-glamajson) - Confirmed ownership claim process and glama.json format
- Direct verification: `npm view replicant-mcp mcpName` returns empty - confirmed mcpName NOT in published package
- Direct verification: `curl glama.ai/mcp/servers/thecombatwombat/replicant-mcp` returns 200 - confirmed Glama listing exists and is claimed
- Direct verification: MCP Registry API returns empty for replicant-mcp - confirmed not yet published
- Direct verification: All Phase 1 PRs (101-104) merged as of 2026-03-25

### Secondary (MEDIUM confidence)
- [Smithery CLI GitHub](https://github.com/smithery-ai/cli) - CLI publish command: `smithery mcp publish <url> -n <org/server>`
- [Smithery docs index](https://smithery.ai/docs/llms.txt) - Confirms release types: hosted, external, stdio (MCPB bundle), repo
- [Cursor blog: New plugins](https://cursor.com/blog/new-plugins) - 30+ community plugins accepted, confirms open submissions

### Tertiary (LOW confidence)
- Smithery web submission flow at smithery.ai/new for stdio repos -- not directly verified via docs (docs focus on HTTP URL). Multiple sources confirm repo connection still works but exact UI flow is uncertain. Needs validation during execution.

## Metadata

**Confidence breakdown:**
- MCP Registry publishing: HIGH - official quickstart docs verified, exact CLI commands documented, blocker (mcpName) identified empirically
- Glama: HIGH - directly verified listing is live and claimed, no action needed
- Smithery: MEDIUM - smithery.yaml exists on master, web submit flow uncertain for stdio repos, CLI fallback available
- Cursor: HIGH - submission URL confirmed, plugin.json on master, manual review process documented
- npm prerequisite: HIGH - empirically confirmed mcpName missing from published package

**Research date:** 2026-03-26
**Valid until:** 2026-04-10 (MCP Registry is in preview -- may change; Smithery evolving; Cursor marketplace relatively new)
