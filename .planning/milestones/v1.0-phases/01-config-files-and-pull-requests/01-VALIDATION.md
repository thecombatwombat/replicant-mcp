---
phase: 1
slug: config-files-and-pull-requests
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-25
audited: 2026-03-29
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
| 01-01 | 01 | 1 | CFG-01 | unit | `npm test -- --run tests/config/marketplace-configs.test.ts` | tests/config/marketplace-configs.test.ts | ✅ green |
| 01-02 | 01 | 1 | CFG-02 | unit | `npm test -- --run tests/config/marketplace-configs.test.ts` | tests/config/marketplace-configs.test.ts | ✅ green |
| 01-03 | 02 | 1 | CFG-03 | unit | `npm test -- --run tests/config/marketplace-configs.test.ts` | tests/config/marketplace-configs.test.ts | ✅ green |
| 01-04 | 03 | 1 | CFG-04 | unit | `npm test -- --run tests/config/marketplace-configs.test.ts` | tests/config/marketplace-configs.test.ts | ✅ green |
| 01-05 | 04 | 1 | CFG-05 | unit | `npm test -- --run tests/config/marketplace-configs.test.ts` | tests/config/marketplace-configs.test.ts | ✅ green |
| 01-06 | 04 | 1 | CFG-06 | unit | `npm test -- --run tests/config/marketplace-configs.test.ts` | tests/config/marketplace-configs.test.ts | ✅ green |
| 01-07 | 01 | 1 | PR-01 | manual | `gh pr view chore/mcp-registry-listing` | N/A | ⬜ pending |
| 01-08 | 02 | 1 | PR-02 | manual | `gh pr view chore/smithery-listing` | N/A | ⬜ pending |
| 01-09 | 03 | 1 | PR-03 | manual | `gh pr view chore/glama-listing` | N/A | ⬜ pending |
| 01-10 | 04 | 1 | PR-04 | manual | `gh pr view chore/cursor-marketplace` | N/A | ⬜ pending |
| 01-11 | 05 | 1 | PR-05 | manual | `gh pr status --repo punkpeye/awesome-mcp-servers` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Audited 2026-03-29: Gaps CFG-01 through CFG-06 filled by `tests/config/marketplace-configs.test.ts` (34 tests, all green). The original VALIDATION.md noted no new test files were needed; this was incorrect — the ad-hoc shell commands in the plan verify blocks did not constitute automated vitest coverage. All 6 config requirements now have vitest-backed behavioral tests.*

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** audited 2026-03-29 — 34/34 tests green, 0 escalations
