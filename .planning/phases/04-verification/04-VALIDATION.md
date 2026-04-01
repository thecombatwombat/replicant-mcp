---
phase: 4
slug: verification
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
audited: 2026-03-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (project test suite) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run smoke checks (VER-01, VER-03 curl commands)
- **After every plan wave:** All automated + browser checks complete
- **Before `/gsd:verify-work`:** All VER items resolved (PASS, CONFIRMED SUBMITTED, PENDING EXTERNAL, or N/A)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | VER-01 | smoke | `curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp" \| jq '.servers[0].server.name'` | N/A (external) | ✅ green |
| 04-01-02 | 01 | 1 | VER-02 | manual-only | Browser: smithery.ai listing page | N/A (web UI) | ✅ green |
| 04-01-03 | 01 | 1 | VER-03 | smoke | `curl -sL "https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp" -o /dev/null -w "%{http_code}"` | N/A (external) | ✅ green |
| 04-01-04 | 01 | 1 | VER-04 | manual-only | Browser: PR #3919 status + mcpservers.org | N/A (external) | ✅ green |
| 04-01-05 | 01 | 1 | VER-05 | document | `npx vitest run tests/config/marketplace-verification.test.ts` | tests/config/marketplace-verification.test.ts | ✅ green |
| 04-01-06 | 01 | 1 | VER-06 | N/A | DEFERRED — FORM-02 deferred to v2 | N/A | ✅ green |
| 04-01-07 | 01 | 1 | VER-07 | document | `npx vitest run tests/config/marketplace-verification.test.ts` | tests/config/marketplace-verification.test.ts | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No code changes or test setup needed — verification is via external API calls, browser checks, and document references.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smithery listing visible | VER-02 | Web UI only, API returns 429 | Open https://smithery.ai/server/@replicant-co/replicant-mcp, verify description + install button |
| awesome-mcp-servers entry | VER-04 | External repo PR merge status | Check PR #3919 merge status on GitHub, then verify mcpservers.org entry |
| MCPB form submitted | VER-05 | Document evidence only | Reference Phase 2 02-01-SUMMARY.md for submission confirmation |
| Cursor plugin submitted | VER-07 | Document evidence only | Reference Phase 3 03-02-SUMMARY.md for submission confirmation |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual verification instructions
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Audit Trail

**Audited:** 2026-03-29 by gsd-nyquist-auditor

### Gaps Filled

| Gap | Requirement | Test File | Command | Result |
|-----|-------------|-----------|---------|--------|
| VER-05 (no_test_file) | Phase 2 SUMMARY contains MCPB form submission evidence | tests/config/marketplace-verification.test.ts | `npx vitest run tests/config/marketplace-verification.test.ts` | green (6/6 pass) |
| VER-07 (no_test_file) | Phase 3 SUMMARY contains Cursor submission evidence | tests/config/marketplace-verification.test.ts | `npx vitest run tests/config/marketplace-verification.test.ts` | green (6/6 pass) |

### Evidence Verified

- VER-05: `02-01-SUMMARY.md` line 59 — "User submitted MCPB Desktop Extensions form with bundle upload" matches `/MCPB.*submitted/i`
- VER-07: `03-02-SUMMARY.md` line 54 — "Submitted Cursor marketplace plugin application with all fields filled" matches `/Cursor.*submitted/i`
