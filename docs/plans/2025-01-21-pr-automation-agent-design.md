# PR Automation Agent

**Status:** Design complete
**Epic:** Developer Experience
**Created:** 2025-01-21

## Overview

Automate the full PR lifecycle as a background agent. When work is complete and it's time to create a PR, automatically spawn an agent that creates the PR, addresses review feedback, and merges when human-approved.

## Goals

- Eliminate manual PR babysitting
- Automatically address Greptile feedback
- Wait for human approval before merging
- Run in background so conversation continues

## Non-goals

- Auto-merge without human approval
- Handle complex merge conflicts (leave for manual resolution)
- Replace human judgment on code quality

## Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Create branch, commit, push                             │
│  2. Create PR via gh                                        │
│  3. Poll loop (max 5 cycles, 2min apart):                   │
│     ├─ Check for Greptile review                            │
│     ├─ Check for human comments/approval                    │
│     ├─ If Greptile comments → address, push, reply          │
│     ├─ If human requested changes → address, push           │
│     └─ If human approved → merge, delete branch, exit       │
│  4. After 5 cycles: report status, leave PR open, exit      │
└─────────────────────────────────────────────────────────────┘
```

## Polling & Decision Logic

Each poll cycle (every 2 minutes, max 5):

1. Fetch PR reviews and comments via `gh pr view --json`
2. If Greptile commented with suggestions:
   - Analyze feedback for validity
   - Make fixes if valid
   - Push updates
   - Reply to comments
3. If human approved:
   - Merge PR via `gh pr merge`
   - Delete remote branch
   - Exit with success
4. If human requested changes:
   - Address the feedback
   - Push updates
   - Continue polling
5. Otherwise:
   - Wait 2 minutes, retry

**Merge gate:** Human approval required. Greptile feedback is informative but not sufficient for merge.

## Implementation

**Type:** Claude Code skill invoked automatically at PR time

**Location:** `.claude/commands/pr-with-review.md` (or skill file)

**Execution:** Background Task agent with `run_in_background: true`

**Pseudocode:**
```bash
# 1. Create and push branch
branch="<prefix>/<topic>"
git checkout -b "$branch"
git add -A
git commit -m "<message>"
git push -u origin "$branch"

# 2. Create PR
gh pr create --title "<title>" --body "<body>"

# 3. Poll loop
for i in {1..5}; do
  sleep 120

  # Fetch reviews
  reviews=$(gh pr view --json reviews,comments)

  # Check for Greptile comments needing action
  # If found: analyze, fix, push, reply

  # Check for human approval
  if human_approved; then
    gh pr merge --merge --delete-branch
    echo "PR merged successfully"
    exit 0
  fi

  # Check for human change requests
  # If found: address, push
done

# 4. Timeout
echo "PR awaiting human approval: <url>"
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Push fails (conflict, permissions) | Report error, exit |
| PR creation fails | Report error, exit |
| Greptile doesn't respond | Continue - only human approval matters |
| Agent can't fix requested changes | Best effort, note uncertainty in reply |
| Merge conflicts during review | Report, leave PR open for manual resolution |
| gh CLI not authenticated | Fail fast with clear error |

## Notifications

- **On merge success:** "PR #N merged successfully"
- **On timeout:** "PR #N awaiting human approval: <url>"
- **On error:** Report what went wrong

## Integration

This becomes the default behavior when the main agent reaches PR creation. Instead of:
```
git push && gh pr create  # then return to user
```

It becomes:
```
Task(background=true, prompt="<pr-automation-skill>")  # conversation continues
```

## Open Questions

- Should the skill live in this repo or in a global Claude Code config?
- Should polling interval be configurable?

## Future Enhancements

- Configurable retry count and interval
- Slack/Discord notification on merge or timeout
- Support for draft PRs that convert to ready when Greptile passes
