# Phase 1: Config Files and Pull Requests - Research

**Researched:** 2026-03-25
**Domain:** Marketplace config files (JSON, YAML) and GitHub PR workflows
**Confidence:** HIGH

## Summary

Phase 1 involves creating marketplace config files for 4 platforms (MCP Registry, Smithery, Glama, Cursor) in the replicant-mcp repo, plus one external PR to awesome-mcp-servers. All 5 tasks are independent and can execute in parallel via git worktrees. The work is straightforward -- each marketplace requires specific config files with well-documented schemas. No code changes, no tests, no runtime behavior changes.

Three critical findings emerged during research: (1) The MCP Registry `server.json` description field has a 100-character maximum, but the plan doc's description is 161 characters and must be shortened. (2) `.mcp.json` is currently in `.gitignore` (line 38), which blocks committing the Cursor marketplace file (CFG-06) -- the gitignore must be updated on the Cursor branch. (3) The awesome-mcp-servers fork does not yet exist for `thecombatwombat` and must be created as part of PR-05.

**Primary recommendation:** Execute all 5 PRs in parallel worktrees. Handle the `.mcp.json` gitignore conflict on the Cursor branch by removing that line from `.gitignore`. Shorten the MCP Registry description to fit the 100-char schema constraint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `@latest` for npx commands in Smithery, Cursor, and any install-time references -- users always get newest
- MCP Registry `server.json` version field: set to `1.6.0` (current) -- will be automated in v2 (REL-01)
- MCP Registry `packages[].version`: set to `1.6.0` -- same manual update policy
- All 5 PRs created in parallel via worktrees (decided during project init)
- Branch names per plan docs: `chore/mcp-registry-listing`, `chore/smithery-listing`, `chore/glama-listing`, `chore/cursor-marketplace`
- awesome-mcp-servers: fork + branch `add-replicant-mcp` on external repo

### Claude's Discretion
- Whether to unify descriptions across marketplaces or tailor per audience
- Exact wording adjustments within existing plan doc templates
- awesome-mcp-servers emoji selection (verify against current legend)
- PR merge order (no dependency between the 5 PRs)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CFG-01 | `.mcp/server.json` created with valid MCP Registry schema and correct metadata | Schema verified at `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`. Description must be <=100 chars. Required fields: name, description, version. `.mcp/` directory is NOT gitignored. |
| CFG-02 | `mcpName` field added to `package.json` matching registry name | Field goes at top level of package.json. Must match `name` in server.json exactly: `io.github.thecombatwombat/replicant-mcp`. Not yet in published npm package. |
| CFG-03 | `smithery.yaml` created with stdio config, commandFunction, and optional projectRoot schema | Format verified against real-world examples. `commandFunction` is a JS arrow function string. `configSchema` uses JSON Schema within YAML. |
| CFG-04 | `glama.json` created with schema URL and maintainer | Schema verified at `https://glama.ai/mcp/schemas/server.json`. Only required field: `maintainers` array of GitHub usernames. |
| CFG-05 | `.cursor-plugin/plugin.json` created with plugin manifest | Only required field: `name`. Optional: description, version, author, homepage, repository, license, keywords, mcpServers, logo. Format verified against official docs and cursor/plugin-template repo. |
| CFG-06 | `.mcp.json` created with MCP server config for Cursor | BLOCKER: `.mcp.json` is currently in `.gitignore` (line 38). Must remove from gitignore on the Cursor branch. Alternatively, use inline `mcpServers` object in plugin.json instead of external file. |
| PR-01 | PR for MCP Registry config (`chore/mcp-registry-listing`) | Branch creates `.mcp/server.json` and edits `package.json` to add `mcpName`. |
| PR-02 | PR for Smithery config (`chore/smithery-listing`) | Branch creates `smithery.yaml` at repo root. Single new file, no edits to existing files. |
| PR-03 | PR for Glama config (`chore/glama-listing`) | Branch creates `glama.json` at repo root. Single new file, no edits to existing files. |
| PR-04 | PR for Cursor config (`chore/cursor-marketplace`) | Branch creates `.cursor-plugin/plugin.json`, `.mcp.json`, and modifies `.gitignore` to un-ignore `.mcp.json`. |
| PR-05 | PR to awesome-mcp-servers adding replicant-mcp to Developer Tools section | External fork PR. Fork does not yet exist -- must `gh repo fork` first. Entry in Developer Tools section, alphabetical by `owner/repo`. Default branch is `main`. |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `gh` CLI | authenticated | Fork repos, create PRs, check status | Already authenticated as `thecombatwombat` with repo scope |
| `git` worktrees | built-in | Parallel branch work without switching | Already configured (`.worktrees/` in gitignore, vitest excludes `.worktrees/**`) |
| `npm` | installed | Verify published package state | Required to confirm `mcpName` propagation |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `jq` | Validate JSON files | Checkpoint validation after creating config files |
| `node -e` / inline JS | Validate YAML / JS arrow functions | Smithery `commandFunction` validation |

### Alternatives Considered
None -- this phase uses only git, GitHub CLI, and file creation. No libraries needed.

## Architecture Patterns

### File Layout (new files this phase adds)
```
replicant-mcp/
  .mcp/
    server.json          # CFG-01: MCP Registry
  .cursor-plugin/
    plugin.json          # CFG-05: Cursor Marketplace
  smithery.yaml          # CFG-03: Smithery
  glama.json             # CFG-04: Glama
  .mcp.json              # CFG-06: Cursor MCP config (requires gitignore change)
  package.json           # CFG-02: add mcpName field (existing file)
  .gitignore             # Modified: remove .mcp.json entry (existing file)
```

### Pattern 1: Parallel Worktrees
**What:** Each marketplace gets its own worktree, branch, and PR -- fully independent.
**When to use:** Always for this phase. The 5 PRs have zero file overlap (except Cursor which touches `.gitignore`).
**Example:**
```bash
# Create worktree for each marketplace
git worktree add .worktrees/mcp-registry chore/mcp-registry-listing
git worktree add .worktrees/smithery chore/smithery-listing
git worktree add .worktrees/glama chore/glama-listing
git worktree add .worktrees/cursor chore/cursor-marketplace
# awesome-mcp-servers uses external fork, not a worktree
```

### Pattern 2: External Fork PR (awesome-mcp-servers)
**What:** Fork an external repo, create branch, add entry, open PR against upstream.
**When to use:** For PR-05 only.
**Example:**
```bash
gh repo fork punkpeye/awesome-mcp-servers --clone=false
# Clone the fork to /tmp, create branch, edit, push, open PR against upstream
```

### Anti-Patterns to Avoid
- **Pushing to master:** CLAUDE.md explicitly forbids this. Always branch + PR.
- **Amending commits across branches:** Each branch gets exactly one commit. No rebasing needed.
- **Editing .gitignore on the wrong branch:** Only the Cursor branch should touch `.gitignore`. Other branches must not conflict.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON validation | Manual field checking | `jq . < file.json` | Catches syntax errors instantly |
| YAML validation | Manual parsing | `node -e "require('yaml').parse(require('fs').readFileSync('smithery.yaml','utf8'))"` | Project already has `yaml` dependency |
| PR creation | Manual `git push` + web UI | `gh pr create` | Consistent, scriptable, matches project patterns |
| Fork management | Manual GitHub web UI | `gh repo fork` | Faster, handles existing forks gracefully |

**Key insight:** This phase is pure config files and git operations. No runtime code, no libraries to install, no build changes.

## Common Pitfalls

### Pitfall 1: MCP Registry Description Too Long
**What goes wrong:** The `server.json` schema enforces `maxLength: 100` on the `description` field. The plan doc's description is 161 characters.
**Why it happens:** Plan docs were written before schema validation was checked.
**How to avoid:** Use a shortened description, e.g.: `"Android MCP server for AI-assisted development. Build, test, emulate, and automate."` (83 chars)
**Warning signs:** `mcp-publisher publish --dry-run` would fail with a validation error.

### Pitfall 2: .mcp.json is Gitignored
**What goes wrong:** `.mcp.json` appears in `.gitignore` line 38. `git add .mcp.json` silently does nothing; the file never gets committed.
**Why it happens:** `.mcp.json` was gitignored because it's a local MCP client config (Claude Code uses it). For Cursor plugins, it needs to be tracked.
**How to avoid:** On the Cursor branch, remove the `.mcp.json` line from `.gitignore` before staging the file. Alternatively, use `git add -f .mcp.json` to force-add, but removing from gitignore is cleaner. Alternative approach: use inline `mcpServers` in `plugin.json` and skip `.mcp.json` entirely.
**Warning signs:** `git status` shows `.mcp.json` is not listed as untracked or staged.

### Pitfall 3: awesome-mcp-servers Alphabetical Ordering
**What goes wrong:** Entry placed in wrong position within Developer Tools section. PR gets rejected or requires changes.
**Why it happens:** The list is sorted by `owner/repo` path. `thecombatwombat/replicant-mcp` needs to be placed between entries starting with `t` in the Developer Tools section.
**How to avoid:** Search for adjacent entries alphabetically. The `t` section in Developer Tools includes entries like `TwelveTake-Studios/reaper-mcp`. Place after entries starting with `thecombatwombat/` or near other `t` entries.
**Warning signs:** Visually check surrounding entries are alphabetically consistent.

### Pitfall 4: awesome-mcp-servers Emoji Mismatch
**What goes wrong:** Using wrong emojis or outdated legend symbols.
**Why it happens:** Legend could change over time.
**How to avoid:** Verified current legend (2026-03-25): `📇` = TypeScript/JS, `🏠` = Local, `🍎` = macOS, `🪟` = Windows, `🐧` = Linux. These match the plan doc exactly.
**Warning signs:** Compare against the Legend section at the top of the README before submitting.

### Pitfall 5: Worktree Conflicts with Existing Worktrees
**What goes wrong:** `.worktrees/` directory already has entries (`readme-rewrite`, `beads-sync`). Creating new worktrees may conflict if branches already exist.
**Why it happens:** Stale worktrees from previous work.
**How to avoid:** Check `git worktree list` before creating new ones. Check `git branch -a` to ensure branch names are available.
**Warning signs:** `git worktree add` returns error about existing branch or path.

### Pitfall 6: npm `files` Field Excludes Config Files
**What goes wrong:** Marketplace config files like `.mcp/server.json`, `smithery.yaml`, `glama.json` don't get published to npm.
**Why it happens:** `package.json` has an explicit `files` array that whitelists only `dist/`, `docs/rtfm/`, `docs/contracts/`, `README.md`, `LICENSE`.
**How to avoid:** This is actually fine -- these config files are only needed in the GitHub repo, not in the npm tarball. `mcp-publisher` reads from the repo, not npm. Smithery reads from the GitHub repo. Glama reads from the GitHub repo. The only npm-relevant change is `mcpName` in `package.json` metadata (which is always included in the tarball).
**Warning signs:** None -- this is expected behavior.

## Code Examples

Verified config file contents from plan docs, cross-referenced with schemas:

### MCP Registry: `.mcp/server.json` (CFG-01)
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.thecombatwombat/replicant-mcp",
  "title": "replicant-mcp",
  "description": "Android MCP server for AI-assisted development. Build, test, emulate, and automate.",
  "repository": {
    "url": "https://github.com/thecombatwombat/replicant-mcp",
    "source": "github"
  },
  "version": "1.6.0",
  "packages": [
    {
      "registryType": "npm",
      "registryBaseUrl": "https://registry.npmjs.org",
      "identifier": "replicant-mcp",
      "version": "1.6.0",
      "runtimeHint": "npx",
      "transport": {
        "type": "stdio"
      },
      "environmentVariables": []
    }
  ]
}
```
**Note:** Description shortened to 83 characters (schema max: 100). Source: [MCP Registry schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json).

### package.json addition (CFG-02)
```json
"mcpName": "io.github.thecombatwombat/replicant-mcp"
```
Add at top level of `package.json`. Must match `name` in `server.json` exactly.

### Smithery: `smithery.yaml` (CFG-03)
```yaml
# Smithery configuration: https://smithery.ai/docs/config#smitheryyaml
startCommand:
  type: stdio
  configSchema:
    type: object
    required: []
    properties:
      projectRoot:
        type: string
        description: "Absolute path to the Android project root (optional, for Gradle builds)"
  commandFunction:
    |-
    (config) => ({
      command: 'npx',
      args: ['-y', 'replicant-mcp@latest'],
      env: config.projectRoot ? { REPLICANT_PROJECT_ROOT: config.projectRoot } : {}
    })
```
Source: Plan doc, verified against [real-world examples](https://github.com/kirill-markin/example-mcp-server/blob/main/smithery.yaml) and [Smithery docs](https://smithery.ai/docs/build/project-config/smithery-yaml).

### Glama: `glama.json` (CFG-04)
```json
{
  "$schema": "https://glama.ai/mcp/schemas/server.json",
  "maintainers": ["thecombatwombat"]
}
```
Source: Plan doc, verified against [Glama schema](https://glama.ai/mcp/schemas/server.json). Only required field is `maintainers`.

### Cursor: `.cursor-plugin/plugin.json` (CFG-05)
```json
{
  "name": "replicant-mcp",
  "description": "Android MCP server for AI-assisted Android development. Build APKs, launch emulators, manage devices, automate UI, and analyze logs.",
  "version": "1.6.0",
  "author": {
    "name": "Archit Joshi"
  },
  "homepage": "https://github.com/thecombatwombat/replicant-mcp",
  "repository": "https://github.com/thecombatwombat/replicant-mcp",
  "license": "MIT",
  "keywords": [
    "android",
    "mcp",
    "adb",
    "gradle",
    "emulator",
    "ui-automation",
    "mobile"
  ],
  "mcpServers": ".mcp.json"
}
```
Source: Plan doc, verified against [Cursor plugin docs](https://cursor.com/docs/plugins/building) and [cursor/plugin-template](https://github.com/cursor/plugin-template). Only required field: `name`.

### Cursor: `.mcp.json` (CFG-06)
```json
{
  "mcpServers": {
    "replicant-mcp": {
      "command": "npx",
      "args": ["-y", "replicant-mcp@latest"],
      "env": {}
    }
  }
}
```
Source: Plan doc, verified against [Cursor docs](https://cursor.com/docs/plugins). Requires `.mcp.json` to be removed from `.gitignore`.

### awesome-mcp-servers Entry (PR-05)
```markdown
- [thecombatwombat/replicant-mcp](https://github.com/thecombatwombat/replicant-mcp) 📇 🏠 🍎 🪟 🐧 - Android MCP server for AI-assisted Android development. Build APKs, launch emulators, manage devices, automate UI, and analyze logs through natural conversation.
```
Source: Plan doc, emojis verified against [current legend](https://github.com/punkpeye/awesome-mcp-servers) (84k stars, default branch: `main`).

## State of the Art

| Aspect | Current State | Impact |
|--------|---------------|--------|
| MCP Registry schema | `2025-12-11` is current, 100-char description limit | Plan doc description must be shortened |
| Smithery | Still supports stdio via `commandFunction` pattern | Plan doc format is current |
| Glama | Auto-indexes repos, `glama.json` for ownership claim only | Minimal effort marketplace |
| Cursor Marketplace | Plugin system with `.cursor-plugin/plugin.json` | Plan doc structure is correct |
| awesome-mcp-servers | 84k+ stars, active maintenance, batch merges | High-visibility listing |

**Deprecated/outdated:**
- None identified. All schema URLs and formats are current as of 2026-03-25.

## Open Questions

1. **`.mcp.json` gitignore resolution strategy**
   - What we know: `.mcp.json` is gitignored (line 38) because it's used as a local Claude Code config. Cursor plugins need it tracked.
   - What's unclear: Will removing `.mcp.json` from `.gitignore` cause issues for developers who have local `.mcp.json` files for Claude Code?
   - Recommendation: Remove from `.gitignore` on the Cursor branch. The file serves double duty -- it's both a Cursor plugin component AND a valid MCP client config. Having it tracked is actually beneficial. Alternative: use inline `mcpServers` in `plugin.json` to avoid the conflict entirely.

2. **MCP Registry description wording**
   - What we know: Must be <= 100 chars. Current plan doc description is 161 chars.
   - What's unclear: Exact wording preference (Claude's discretion per CONTEXT.md).
   - Recommendation: `"Android MCP server for AI-assisted development. Build, test, emulate, and automate."` (83 chars). Alternatively: `"Android MCP server for AI-assisted Android development. Build APKs, emulators, and UI automation."` (97 chars).

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
| CFG-01 | `.mcp/server.json` valid JSON, schema-compliant | smoke | `jq . .mcp/server.json` | N/A (file validation, not code test) |
| CFG-02 | `mcpName` in `package.json` matches server.json name | smoke | `node -e "const p=require('./package.json'); console.assert(p.mcpName==='io.github.thecombatwombat/replicant-mcp')"` | N/A |
| CFG-03 | `smithery.yaml` valid YAML with correct structure | smoke | `node -e "require('yaml').parse(require('fs').readFileSync('smithery.yaml','utf8'))"` | N/A |
| CFG-04 | `glama.json` valid JSON, schema-compliant | smoke | `jq . glama.json` | N/A |
| CFG-05 | `.cursor-plugin/plugin.json` valid JSON | smoke | `jq . .cursor-plugin/plugin.json` | N/A |
| CFG-06 | `.mcp.json` valid JSON, not gitignored | smoke | `jq . .mcp.json && git check-ignore .mcp.json; test $? -eq 1` | N/A |
| PR-01 | PR created on correct branch | manual | `gh pr view chore/mcp-registry-listing` | N/A |
| PR-02 | PR created on correct branch | manual | `gh pr view chore/smithery-listing` | N/A |
| PR-03 | PR created on correct branch | manual | `gh pr view chore/glama-listing` | N/A |
| PR-04 | PR created on correct branch | manual | `gh pr view chore/cursor-marketplace` | N/A |
| PR-05 | PR created on awesome-mcp-servers | manual | `gh pr status --repo punkpeye/awesome-mcp-servers` | N/A |

### Sampling Rate
- **Per task commit:** `jq . <config-file>` (JSON validation) or yaml parse (YAML validation)
- **Per wave merge:** `npm run test:coverage` (ensure no regressions from package.json edit)
- **Phase gate:** All 5 PRs open and passing CI

### Wave 0 Gaps
None -- this phase creates config files only. No new test files needed. Existing test suite validates that the package.json edit (adding `mcpName`) doesn't break anything.

## Sources

### Primary (HIGH confidence)
- [MCP Registry server.schema.json](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json) - Verified description maxLength: 100, required fields, package transport schema
- [Glama server.json schema](https://glama.ai/mcp/schemas/server.json) - Verified only `maintainers` is required
- [Cursor plugin docs](https://cursor.com/docs/plugins/building) - Verified plugin.json fields, mcpServers config, .mcp.json auto-discovery
- [cursor/plugin-template](https://github.com/cursor/plugin-template) - Verified official plugin structure with mcp.json
- [awesome-mcp-servers README](https://github.com/punkpeye/awesome-mcp-servers) - Verified emoji legend, Developer Tools section format, alphabetical ordering, default branch `main`
- Local `.gitignore` verification - Confirmed `.mcp.json` is gitignored, `.mcp/` is not
- `npm view replicant-mcp` - Confirmed v1.6.0 published, no `mcpName` field yet
- `gh auth status` - Confirmed authenticated as `thecombatwombat` with repo scope

### Secondary (MEDIUM confidence)
- [Smithery docs](https://smithery.ai/docs/build/project-config/smithery-yaml) - Page returned 404 but format verified against multiple real-world examples on GitHub
- Real-world smithery.yaml examples: [example-mcp-server](https://github.com/kirill-markin/example-mcp-server/blob/main/smithery.yaml), [win-cli-mcp-server](https://github.com/simon-ami/win-cli-mcp-server/blob/main/smithery.yaml)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified all schemas, CLI tools, and repo state directly
- Architecture: HIGH - file layout is explicitly defined in plan docs, verified against official schemas
- Pitfalls: HIGH - `.mcp.json` gitignore and description length issues confirmed empirically

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- marketplace schemas change infrequently)
