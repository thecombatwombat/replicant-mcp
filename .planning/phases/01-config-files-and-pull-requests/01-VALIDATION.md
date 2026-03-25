---
phase: 1
slug: config-files-and-pull-requests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Validate config file syntax (jq/yaml parse)
- **After every plan wave:** Run `npm run test:coverage` (ensure no regressions from package.json edit)
- **Before `/gsd:verify-work`:** All 5 PRs open and passing CI
- **Max feedback latency:** 5 seconds (file validation is instant)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | CFG-01 | smoke | `jq . .mcp/server.json` | N/A | ⬜ pending |
| 01-02 | 01 | 1 | CFG-02 | smoke | `node -e "const p=require('./package.json'); console.assert(p.mcpName==='io.github.thecombatwombat/replicant-mcp')"` | N/A | ⬜ pending |
| 01-03 | 02 | 1 | CFG-03 | smoke | `node -e "require('yaml').parse(require('fs').readFileSync('smithery.yaml','utf8'))"` | N/A | ⬜ pending |
| 01-04 | 03 | 1 | CFG-04 | smoke | `jq . glama.json` | N/A | ⬜ pending |
| 01-05 | 04 | 1 | CFG-05 | smoke | `jq . .cursor-plugin/plugin.json` | N/A | ⬜ pending |
| 01-06 | 04 | 1 | CFG-06 | smoke | `jq . .mcp.json && git check-ignore .mcp.json; test $? -eq 1` | N/A | ⬜ pending |
| 01-07 | 01 | 1 | PR-01 | manual | `gh pr view chore/mcp-registry-listing` | N/A | ⬜ pending |
| 01-08 | 02 | 1 | PR-02 | manual | `gh pr view chore/smithery-listing` | N/A | ⬜ pending |
| 01-09 | 03 | 1 | PR-03 | manual | `gh pr view chore/glama-listing` | N/A | ⬜ pending |
| 01-10 | 04 | 1 | PR-04 | manual | `gh pr view chore/cursor-marketplace` | N/A | ⬜ pending |
| 01-11 | 05 | 1 | PR-05 | manual | `gh pr status --repo punkpeye/awesome-mcp-servers` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test files needed — validation is config file syntax checking (jq, yaml parse) and PR existence verification (gh CLI).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR-01 open with correct files | PR-01 | GitHub PR creation is an external action | `gh pr view chore/mcp-registry-listing --json files` |
| PR-02 open with correct files | PR-02 | GitHub PR creation is an external action | `gh pr view chore/smithery-listing --json files` |
| PR-03 open with correct files | PR-03 | GitHub PR creation is an external action | `gh pr view chore/glama-listing --json files` |
| PR-04 open with correct files | PR-04 | GitHub PR creation is an external action | `gh pr view chore/cursor-marketplace --json files` |
| PR-05 open on external repo | PR-05 | External fork PR | `gh pr status --repo punkpeye/awesome-mcp-servers` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
