---
phase: 3
slug: registry-publishing
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
updated: 2026-03-29
---

# Phase 3 — Validation Strategy

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

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm run test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PUB-01 | smoke | `npm view replicant-mcp mcpName` | N/A | ✅ green |
| 03-01-02 | 01 | 1 | PUB-01 | integration | `npx vitest run tests/config/marketplace-publishing.test.ts` | `tests/config/marketplace-publishing.test.ts` | ✅ green |
| 03-02-01 | 02 | 1 | PUB-02 | manual-only | Search "replicant-mcp" at smithery.ai | N/A | ⬜ pending |
| 03-03-01 | 02 | 1 | PUB-03 | integration | `npx vitest run tests/config/marketplace-publishing.test.ts` | `tests/config/marketplace-publishing.test.ts` | ✅ green |
| 03-04-01 | 02 | 1 | PUB-04 | manual-only | Check cursor.com/marketplace for pending submission | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase involves CLI tools and web submissions, not code changes requiring new test infrastructure. The prerequisite npm release uses the existing test suite via `npm run release` (which runs `prepublishOnly` -> build + test).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smithery listing accepted | PUB-02 | Web UI submission, no public API for verification | 1. Go to smithery.ai 2. Search "replicant-mcp" 3. Confirm listing appears |
| Cursor plugin submitted | PUB-04 | Manual review process, no API for submission status | 1. Go to cursor.com/marketplace 2. Check for replicant-mcp pending/listed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete (2026-03-29, gsd-nyquist-auditor — PUB-01 and PUB-03 gaps filled with tests/config/marketplace-publishing.test.ts)
