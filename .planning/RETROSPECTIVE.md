# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Marketplace Distribution

**Shipped:** 2026-04-01
**Phases:** 5 | **Plans:** 9 | **Tasks:** 19

### What Was Built
- Config files for 6 marketplaces (MCP Registry, Smithery, Glama, Cursor, awesome-mcp-servers, Anthropic Connectors)
- CLI publishing to MCP Registry and Smithery
- Form submission content for Anthropic Connectors (MCPB Desktop Extensions)
- Cursor marketplace plugin with custom logo
- Full verification sweep across all 7 target marketplaces
- Retroactive verification and release script hardening in Phase 5

### What Worked
- Parallel worktree execution for Phase 1 — 4 independent marketplace PRs created efficiently
- GSD workflow kept distribution-only scope clean (no feature creep into product development)
- Milestone audit caught real gaps (FORM-01 orphan, stale checkboxes, version drift) that Phase 5 closed
- Phase 2 running in parallel with Phase 1 PR reviews saved wall-clock time

### What Was Inefficient
- awesome-mcp-servers upstream repo was deleted after PR was opened — wasted effort that couldn't be predicted
- Smithery listing exists but is unlisted because dashboard configuration wasn't part of the CLI publish flow — needed manual follow-up
- Phase 2 was the only phase without a VERIFICATION.md, requiring retroactive gap closure in Phase 5
- Nyquist validation was done retroactively for all phases rather than inline during execution

### Patterns Established
- Release script should sync ALL version-bearing files (now includes .cursor-plugin/plugin.json)
- Every phase needs a VERIFICATION.md — enforce this at plan time, not audit time
- External dependencies (form reviews, repo availability) should be flagged as risks in requirements

### Key Lessons
1. **Verify external resources before planning** — awesome-mcp-servers repo deletion cost a full plan's effort
2. **Build verification into every phase** — retroactive verification (Phase 5) is more expensive than inline verification
3. **Dashboard config is part of "published"** — CLI publish alone doesn't make a listing discoverable (Smithery)
4. **Milestone audits are valuable** — caught 6 real issues that would have been missed without structured audit

### Cost Observations
- Model mix: ~70% sonnet (executor agents), ~30% opus (orchestrator, planning)
- Timeline: 7 calendar days (2026-03-25 → 2026-04-01)
- Notable: Phase 1 parallel worktrees were the most efficient pattern — 4 PRs in one session

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | 9 | First milestone — established GSD workflow for distribution tasks |

### Top Lessons (Verified Across Milestones)

1. Milestone audits catch real gaps — enforce them before completion
2. External dependencies are the biggest risk to timeline predictability
