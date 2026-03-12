# Beads to Linear Migration Design

## Context

replicant-mcp has 175 beads issues (90 open, 13 epics, 72 "ready to work"). Beads is being used as a full project management tool — but it was designed for cross-session agent working memory, not backlog management. The agent creates all tickets; the user never reviews them; `bd ready` returns a firehose.

## Target State

| Layer | Tool | Scope |
|-------|------|-------|
| This session | Claude Tasks | Intra-session coordination |
| This week | Beads | Cross-session context recovery, 3-5 active items |
| This quarter | Linear | Roadmap, backlog, collaboration, reporting |

## What We're Exporting

All 90 open beads issues → Linear issues in the `replicant-mcp` project.

## Field Mapping

| Beads Field | Linear Field |
|-------------|-------------|
| Title | `original title [beads-id]` (temporary, stripped post-migration) |
| Description | Issue description body |
| Priority | P0→Urgent, P1→High, P2→Medium, P3→Low, P4→No priority |
| Parent epic | Label with epic's title |
| Type (epic) | Additional "Epic" label |
| Status (open) | "Backlog" state |
| Status (in_progress) | "In Progress" state |
| Dependencies | "Blocked by" relations (second pass) |

## Execution Plan

### Phase 0: Documentation
1. Document current beads usage, problems, and migration rationale (beads issue `replicant-mcp-u3x`)
2. This must be completed before any export work begins

### Phase 1: Prep
1. Take a beads snapshot backup: `bd export > docs/migration/beads-snapshot-pre-migration.jsonl`
2. Create Linear labels for each distinct epic name + an "Epic" label
3. **Validate:** count labels created matches number of distinct epics in beads

### Phase 2: Import
4. Export beads issues via `bd export`
5. For each open issue, create a Linear issue with the field mapping above
6. Build a `beads-id → linear-id` lookup map during creation
7. Save lookup to `docs/migration/beads-to-linear-map.json` and commit
8. **Validate:**
   - Count Linear issues in project = count of open beads issues exported
   - Spot-check 3-5 issues: title format, priority, labels, description
   - Verify no beads IDs missing from lookup map

### Phase 3: Dependencies
9. For each beads dependency, create a "blocked by" relation in Linear using the lookup map
10. **Validate:**
    - For each dependency in beads, query the Linear issue's relations and confirm match
    - Count total relations created = total beads dependencies

### Phase 4: Cleanup (separate session, explicit user approval required)
11. Slim down CLAUDE.md beads rules (remove mandatory epic parenting, no-orphan rule, pre-decomposition)
12. Close/archive beads issues that moved to Linear
13. Strip `[beads-id]` suffixes from Linear issue titles
14. Update PreToolUse hooks to remove orphan enforcement

## Rollback Plan

**Key property:** All Linear operations are additive. Beads is untouched until Phase 4, which requires explicit user approval in a separate session.

| Failure point | Recovery |
|---------------|----------|
| Import fails mid-way | Lookup map shows exactly which issues were created. Resume from last successful, or delete all created issues and restart. |
| Bad data discovered post-import | Delete/archive Linear issues. Beads is still source of truth. |
| Nuclear rollback | Delete all issues in replicant-mcp Linear project + all created labels. Beads unchanged. |

**Trade-off:** If we create 90 issues then delete them, Linear's issue counter (THE-1, THE-2...) will have a gap. Cosmetic only.

## Artifacts Produced

- `docs/migration/beads-snapshot-pre-migration.jsonl` — full beads export before any changes
- `docs/migration/beads-to-linear-map.json` — beads-id to Linear-id cross-reference
- `docs/plans/2026-03-12-beads-to-linear-migration-design.md` — this document
