# Roadmap: Marketplace Distribution for replicant-mcp

## Overview

Get replicant-mcp listed on all 7 viable MCP marketplaces. The work moves through four natural stages: create config files and open PRs (parallelizable across worktrees), prepare form submission content for marketplaces requiring manual entry, publish to CLI/web-based registries after PRs merge, and verify all listings are live.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Config Files and Pull Requests** - Add marketplace config files to the repo and open PRs for all 4 code-change marketplaces plus awesome-mcp-servers (completed 2026-03-25)
- [x] **Phase 2: Form Submissions** - Prepare and submit Anthropic Connectors and Claude Code Plugin Directory forms (completed 2026-03-26)
- [x] **Phase 3: Registry Publishing** - Publish to MCP Registry, Smithery, Glama, and Cursor after PRs are merged (completed 2026-03-27)
- [x] **Phase 4: Verification** - Confirm all 7 marketplace listings are live and correct (completed 2026-03-28)
- [x] **Phase 5: Audit Gap Closure & Cleanup** - Fix FORM-01 orphan, stale checkboxes, version drift, and release script gap (Gap Closure) (completed 2026-04-01)

## Phase Details

### Phase 1: Config Files and Pull Requests
**Goal**: All marketplace config files exist in the repo behind open PRs ready for review and merge
**Depends on**: Nothing (first phase)
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, CFG-06, PR-01, PR-02, PR-03, PR-04, PR-05
**Success Criteria** (what must be TRUE):
  1. Each of the 4 config-change marketplaces (MCP Registry, Smithery, Glama, Cursor) has a PR open with the correct config files
  2. The awesome-mcp-servers PR is open against punkpeye/awesome-mcp-servers with replicant-mcp in the Developer Tools section
  3. All 5 PRs pass CI checks and contain only the files specified in the per-marketplace plan docs
  4. Config files follow each marketplace's documented schema (validated against plan docs)
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — MCP Registry config files and PR (CFG-01, CFG-02, PR-01)
- [x] 01-02-PLAN.md — Smithery and Glama config files and PRs (CFG-03, CFG-04, PR-02, PR-03)
- [x] 01-03-PLAN.md — Cursor marketplace plugin files and PR (CFG-05, CFG-06, PR-04)
- [x] 01-04-PLAN.md — awesome-mcp-servers fork and PR (PR-05)

### Phase 2: Form Submissions
**Goal**: Users (marketplaces with manual form submission) have received complete, accurate applications for replicant-mcp
**Depends on**: Nothing (can run in parallel with Phase 1 PR reviews)
**Requirements**: FORM-01, FORM-02
**Success Criteria** (what must be TRUE):
  1. Anthropic Connectors Google Form answers are prepared with description, example prompts, and safety information ready for user to submit
  2. Claude Code Plugin Directory form answers are prepared with description, features, and example prompts ready for user to submit
  3. User has submitted both forms (confirmation received or screenshot captured)
**Plans:** 1 plan

Plans:
- [x] 02-01-PLAN.md — Prepare form answers and submit both marketplace forms (FORM-01, FORM-02)

### Phase 3: Registry Publishing
**Goal**: replicant-mcp is submitted to all 4 CLI/web-publish marketplaces
**Depends on**: Phase 1 (PRs must be merged and config files on master/npm)
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04
**Success Criteria** (what must be TRUE):
  1. MCP Registry publish command completes successfully with `mcp-publisher publish`
  2. Smithery submission is accepted via web or CLI
  3. Glama ownership is claimed via GitHub auth at glama.ai
  4. Cursor plugin is submitted at cursor.com/marketplace/publish
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — npm release prerequisite and MCP Registry publish via mcp-publisher CLI (PUB-01)
- [x] 03-02-PLAN.md — Smithery and Cursor web submissions, Glama listing confirmation (PUB-02, PUB-03, PUB-04)

### Phase 4: Verification
**Goal**: Every marketplace listing is confirmed live (or confirmed submitted for those with external review)
**Depends on**: Phase 2, Phase 3
**Requirements**: VER-01, VER-02, VER-03, VER-04, VER-05, VER-06, VER-07
**Success Criteria** (what must be TRUE):
  1. MCP Registry API query returns correct replicant-mcp metadata
  2. Smithery search shows replicant-mcp with accurate description and install button
  3. Glama server page exists at expected URL with correct tool list
  4. awesome-mcp-servers README and mcpservers.org both show replicant-mcp entry
  5. Anthropic Connectors, Claude Code Plugin Directory, and Cursor submissions are confirmed sent (listing may be pending external review)
**Plans:** 1/1 plans complete

Plans:
- [x] 04-01-PLAN.md — Verify all 7 marketplace listings via API checks, browser verification, and document evidence (VER-01 through VER-07)

### Phase 5: Audit Gap Closure & Cleanup
**Goal**: Close the FORM-01 orphan gap (missing Phase 2 VERIFICATION.md), fix stale documentation, and prevent future version drift
**Depends on**: Phase 4 (audit must be complete)
**Requirements**: FORM-01 (re-verify)
**Gap Closure**: Closes gaps from v1.0 milestone audit (2026-04-01)
**Success Criteria** (what must be TRUE):
  1. Phase 2 VERIFICATION.md exists and covers FORM-01 in its requirements table
  2. PUB-01 through PUB-04 checkboxes are marked [x] in REQUIREMENTS.md
  3. `.cursor-plugin/plugin.json` version matches current release (1.6.1)
  4. `scripts/release.sh` syncs `.cursor-plugin/plugin.json` version on release
**Plans:** 1/1 plans complete

Plans:
- [x] 05-01-PLAN.md — Phase 2 retroactive verification, REQUIREMENTS.md cleanup, version sync fix (FORM-01, tech debt)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Config Files and Pull Requests | 4/4 | Complete | 2026-03-25 |
| 2. Form Submissions | 1/1 | Complete | 2026-03-26 |
| 3. Registry Publishing | 2/2 | Complete | 2026-03-27 |
| 4. Verification | 1/1 | Complete | 2026-03-29 |
| 5. Audit Gap Closure & Cleanup | 1/1 | Complete | 2026-04-01 |
