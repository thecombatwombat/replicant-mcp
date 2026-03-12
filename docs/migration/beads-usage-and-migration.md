# Beads Usage in replicant-mcp: Current State, Problems, and Migration

## What Beads Is

Beads is a git-backed issue tracker designed for **cross-session agent working memory**. Its core value is context recovery — when a Claude Code session compacts or a new conversation starts, beads gives the agent enough state to resume work without the user re-explaining everything.

## How We're Currently Using It

We use beads as the **primary project management system** for replicant-mcp:

- **175 total issues** (90 open, 85 closed, 11 epics)
- **72 "ready to work" items** in `bd ready`
- Full epic hierarchy with dependency chains
- Session hooks for auto-sync on start/end (`scripts/beads-sync-start.sh`, `scripts/beads-sync-end.sh`)
- PreToolUse hook for pre-PR validation (`scripts/pre-pr-gate.sh`)

The agent creates all tickets. The user rarely reviews them. Every piece of planned work — from P1 features to P4 backlog ideas — lives in beads.

## What's Wrong

### 1. Beads is not a project management tool

Beads was designed for 3-5 active items that help an agent resume work across sessions. We're using it to track a full product roadmap with 13 epics, dependency chains, and priority levels. This is Jira-shaped work in a tool that isn't Jira.

Community consensus backs this up:
- **Ian Bull**: "near-term, actionable work, not distant backlogs"
- **JX0**: beads as persistent state for resumability, not backlog
- **Paddo.dev**: beads + Tasks are complementary layers, not Linear replacements

### 2. `bd ready` is a firehose

72 ready items means the agent has no focus signal. When everything is "ready," nothing is prioritized. The agent picks arbitrarily or asks the user what to do — defeating the purpose of having a task system.

### 3. Pre-decomposition creates waste

We decompose entire epics into sub-tasks before work starts. Most of these tasks are never touched. The decomposition itself costs time and context, and the resulting tasks go stale as understanding evolves.

### 4. The user never looks at the issues

All 175 issues were created by the agent. The user interacts with beads indirectly through `bd ready` prompts. There's no dashboard, no triage, no planning review. Beads lacks the UI and reporting that makes a backlog useful to humans.

### 5. Sync conflicts

The beads auto-sync mechanism (`beads-sync` branch) regularly hits merge conflicts on `.beads/issues.jsonl`, requiring manual intervention. This is a symptom of the tool being overloaded — too many issues changing too often.

## Where We're Moving

### New layering

| Layer | Tool | Scope |
|-------|------|-------|
| This session | Claude Tasks | Intra-session step tracking |
| This week | Beads | Cross-session context recovery, 3-5 active items max |
| This quarter | Linear | Roadmap, backlog, collaboration, reporting |

### Migration plan

1. **Export all 90 open beads issues to Linear** — preserving titles, priorities, epic grouping (as labels), and dependency chains (as "blocked by" relations)
2. **Slim beads down** — remove mandatory epic parenting, orphan rules, pre-decomposition requirements
3. **Update CLAUDE.md** — new guidance: "use beads for active cross-session work only, 3-5 items max"
4. **Archive beads issues** that now live in Linear

### What stays in beads

- Active work items that span the current and next session
- Dependencies as agent execution control ("don't touch Y until X is done")
- Session boundary state for context recovery after compaction

### What moves to Linear

- Product roadmap and backlog
- Epic-level planning
- Priority triage and reporting
- Anything the user wants to review, sort, or share

See `docs/plans/2026-03-12-beads-to-linear-migration-design.md` for the full technical design.
