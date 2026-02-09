# CLAUDE.md Enforcement: Workflow Support + Execution Gates

## Context

**The real problem:** Rules exist but workflow doesn't support following them naturally.

**Example:** I pushed to master because there was no local gate. But deeper issue: the workflow doesn't separate thinking → planning → beads filing → execution. Plan mode flows directly to execution without pause.

**User's vision:**
- Think mode (research, understand) → Plan mode (explore, design) → Beads filing (scope, context) → Execution gate (now? later? never?)
- Beads as scope control: file discovered problems, don't solve immediately
- Multi-agent coordination: agents pick from beads graph
- Context preservation: plans + beads survive sessions

**Current gap:** Plan mode is valuable (research agents, Anthropic momentum) but workflow doesn't support execution buffer pattern.

---

## The Workflow We Want

```
┌─────────────┐
│ Think Mode  │ Research, explore, understand problems
│ (optional)  │
└──────┬──────┘
       │
┌──────▼──────┐
│ Plan Mode   │ Explore/Plan agents, create design + work graph
│ (official)  │ Uses Claude Code's built-in plan mode
└──────┬──────┘
       │
┌──────▼──────────────┐
│ Plan Approval       │ Review plan, provide feedback
│ (ExitPlanMode)      │
└──────┬──────────────┘
       │
┌──────▼──────────────┐
│ Auto-actions:       │
│ 1. Persist plan     │ cp to docs/plans/YYYY-MM-DD-<topic>.md
│ 2. Generate beads   │ Create epic + tasks + dependencies
│ 3. Execution gate   │ "Execute now? File for later?"
└──────┬──────────────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌─────▼────────┐
│ Execute Now │   │ File & Stop  │
│             │   │              │
│ Agent picks │   │ Work queued  │
│ from beads  │   │ for later    │
└─────────────┘   └──────────────┘
```

---

## Solution: Two-Part Enhancement

### Part 1: Enhance Plan Mode Workflow (Priority 1)

**Make plan mode support execution buffer pattern.**

#### 1.1 Enhance ExitPlanMode Tool

**Current behavior:**
- Agent calls ExitPlanMode
- User approves plan
- Agent immediately starts execution

**New behavior:**
- Agent calls ExitPlanMode
- User approves plan
- **Auto-actions triggered:**
  1. Persist plan to `docs/plans/YYYY-MM-DD-<topic>.md`
  2. Parse plan for work items, generate beads structure
  3. Present execution gate: "Execute now? File for later? Both?"
- Agent waits for user decision

**Implementation:**

ExitPlanMode should trigger a post-approval hook that:

```typescript
// Pseudocode for ExitPlanMode enhancement
async function onPlanApproved(planFile: string) {
  // 1. Persist plan
  const topic = extractTopicFromPlan(planFile);
  const date = new Date().toISOString().split('T')[0];
  const persistPath = `docs/plans/${date}-${topic}.md`;
  await copyFile(planFile, persistPath);
  await git.add(persistPath);

  // 2. Parse plan for work structure
  const workStructure = parsePlanForWork(planFile);
  // Looks for: epic title, child tasks, dependencies

  // 3. Generate beads commands
  const beadsCommands = generateBeadsCommands(workStructure);

  // 4. Present to user
  return {
    message: `Plan persisted to ${persistPath}\n\nGenerated beads structure:\n${beadsCommands}\n\nExecute now, file for later, or both?`,
    options: ['Execute now', 'File beads and stop', 'File beads then execute']
  };
}
```

**Plan parsing heuristics:**
- Epic title: First H1 or "Context" section summary
- Tasks: H2/H3 headers in "Implementation" section
- Dependencies: Parse "depends on" / "blocks" / "after" language

**Execution gate:**
- "Execute now" → Skip beads, start implementation immediately (current behavior)
- "File beads and stop" → Create beads, exit session or return to thinking
- "File beads then execute" → Create beads, mark one as in_progress, start work

#### 1.2 Plan Template Enhancement

**Update plan mode instructions to output parseable structure:**

```markdown
## Implementation

### Epic: <Epic title here>

### Tasks:
1. **<Task 1 title>** - Description. [depends on: none]
2. **<Task 2 title>** - Description. [depends on: Task 1]
3. **<Task 3 title>** - Description. [depends on: Task 1]
```

This makes parsing reliable. Agent naturally produces this in Phase 4 (Final Plan).

#### 1.3 Documentation Update

**CLAUDE.md addition:**

```markdown
## Plan Mode Workflow

After plan approval (ExitPlanMode), three auto-actions occur:

1. **Plan persistence**: Copied to `docs/plans/YYYY-MM-DD-<topic>.md`
2. **Beads generation**: Epic + tasks created from plan structure
3. **Execution gate**: Choose whether to execute now or defer

Use "File beads and stop" when:
- Planning for future work
- Need to prioritize against other work
- Want multiple agents to execute in parallel later

Use "Execute now" when:
- Urgent fix needed immediately
- Simple single-agent work
- Already decided execution order
```

---

### Part 2: Execution-Time Enforcement (Priority 2)

**Prevent violations during execution, not at planning time.**

#### 2.1 Git Pre-Push Hook (Master Protection)

**Create:** `.githooks/pre-push`

**Purpose:** Block accidental pushes to master, enforce branch naming conventions.

**Logic:**
```bash
#!/bin/sh
# Block direct pushes to master/main

remote="$1"
while read local_ref local_oid remote_ref remote_oid; do
  branch=$(echo "$local_ref" | sed 's/refs\/heads\///g')

  # Block master/main, with release exception
  if [[ "$branch" =~ ^(master|main)$ ]]; then
    # Allow if release commit
    if git log -1 --format=%B | grep -q "^chore: release v[0-9]"; then
      exit 0
    fi

    echo "✗ ERROR: Cannot push directly to $branch"
    echo "  Use: git checkout -b feature/<name> && git push"
    exit 1
  fi

  # Warn about non-standard branch names
  if [[ ! "$branch" =~ ^(feature|fix|docs|refactor|chore|trivial)/ ]] && \
     [[ ! "$branch" =~ ^(master|main)$ ]]; then
    echo "⚠ WARNING: Non-standard branch name: $branch"
    echo "  Recommended: feature/fix/docs/refactor/chore/trivial/"
    echo "  Proceeding anyway..."
  fi
done
exit 0
```

**Setup:**
- Commit `.githooks/pre-push` to repo
- Add to SessionStart hook: `git config core.hooksPath .githooks`

#### 2.2 Pre-Commit Check (Scope Discovery)

**Purpose:** Help agents file beads for discovered problems during execution.

**Logic:**
```bash
#!/bin/sh
# Suggest filing beads if work is growing beyond scope

# Check if current branch has a beads issue
current_branch=$(git rev-parse --abbrev-ref HEAD)

# Skip for trivial branches
if [[ "$current_branch" == trivial/* ]]; then
  exit 0
fi

# Check staged changes
staged_files=$(git diff --cached --name-only | wc -l | tr -d ' ')
staged_lines=$(git diff --cached --stat | tail -1 | awk '{print $4}' | tr -d '+')

# If substantial changes, check for beads issue
if [ "$staged_files" -gt 5 ] || [ "$staged_lines" -gt 100 ]; then
  in_progress=$(bd list --status=in_progress 2>/dev/null | wc -l | tr -d ' ')

  if [ "$in_progress" -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠ SUGGESTION: Substantial work detected"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Staged: $staged_files files, ~$staged_lines lines"
    echo "No in-progress beads issue found."
    echo ""
    echo "Consider: bd create --title='...' && bd update <id> --status=in_progress"
    echo ""
    echo "Or use trivial/ branch prefix to skip this check."
    echo ""
    # Don't block - just educate
  fi
fi

exit 0
```

**Design:** Suggest, don't block. Helps agents recognize when work is growing beyond original scope.

#### 2.3 Module-Level State Detection

**Add to `scripts/check-complexity.sh`:**

```bash
check_module_state() {
  violations=$(find "$SRC_DIR" -name '*.ts' \
    -not -path '*/node_modules/*' \
    -not -path '*/cli/*' \
    -not -name '*.test.ts' \
    -exec grep -Hn "^(let|var) \w\+ =" {} \; 2>/dev/null || true)

  if [ -n "$violations" ]; then
    echo "❌ Module-level mutable state:"
    echo "$violations"
    return 1
  fi
}
```

**Wired into:** pre-pr-gate, CI, npm script (existing pattern).

---

## Critical Files

**New files:**
- `.githooks/pre-push` - Master protection + branch naming
- `.githooks/pre-commit` - Scope discovery suggestions
- `.githooks/README.md` - Hook documentation

**Modified files:**
- `ExitPlanMode` tool implementation (if accessible) - Add post-approval hook
- OR `.claude/hooks/PlanModeExit.sh` (if hooks support this) - Trigger auto-actions
- `CLAUDE.md` - Document new plan mode workflow
- `scripts/check-complexity.sh` - Add module state check
- `DECISIONS.md` - ADR for this approach

**Question:** Can we hook into ExitPlanMode's approval flow, or do we need a different mechanism?

---

## Verification

### Test 1: Plan Mode Workflow

```bash
# Enter plan mode
/plan

# After approval, should:
# 1. See plan copied to docs/plans/2026-02-08-<topic>.md
# 2. See generated beads commands
# 3. See execution gate prompt: "Execute now? File for later?"

# Choose "File beads and stop"
# Result: Beads created, session stops (or returns to chat)
```

### Test 2: Master Push Protection

```bash
git checkout master
echo "test" >> README.md
git commit -m "test"
git push origin master
# Expected: Blocked with error message

git commit --amend -m "chore: release v1.0.0"
git push origin master
# Expected: Allowed (release exception)
```

### Test 3: Scope Discovery

```bash
git checkout -b feature/test
# Make changes to 6+ files
git add .
git commit -m "test"
# Expected: Suggestion to create beads issue
```

---

## Open Questions

1. **ExitPlanMode hook access**: Can we hook into the approval flow directly, or do we need to implement post-approval actions via another mechanism (SessionEnd hook, wrapper script, etc.)?

2. **Plan parsing reliability**: How robust should the parsing be? Should we require strict format or be lenient?

3. **Execution gate UI**: Should this be:
   - AskUserQuestion with multiple choice?
   - Automatic based on heuristics (if large plan → file beads)?
   - Always file beads, optionally execute?

4. **Beads granularity**: How do we decide what's "significant enough" to require beads filing from a plan? Always create epic + tasks, or only for multi-step work?

5. **Trivial threshold**: When can work skip the entire flow (no plan, no beads, direct commit)? Current: `trivial/` branch prefix. Is this sufficient?

