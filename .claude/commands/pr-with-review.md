---
description: "Automate full PR lifecycle with Greptile review handling"
argument-hint: "--branch <name> --title <title> [--body <body>] [--commit-message <msg>]"
allowed-tools: ["Bash", "Read", "Edit", "Glob", "Grep"]
---

# PR Automation with Review Handling

Automate the full pull request lifecycle: create branch, commit, push, create PR, poll for reviews, address Greptile feedback, and merge on human approval.

## Arguments

Parse from `$ARGUMENTS`:
- `--branch <name>` (required): Branch name (must follow project conventions: feature/, fix/, docs/, refactor/, chore/)
- `--title <title>` (required): PR title
- `--body <body>` (optional): PR description body
- `--commit-message <msg>` (optional): Custom commit message (defaults to PR title)

## Phase 1: Setup and Validation

1. **Parse arguments** from `$ARGUMENTS`
   - Extract branch, title, body, commit_message
   - If commit_message not provided, use title
   - Validate branch follows naming convention (feature/, fix/, docs/, refactor/, chore/)

2. **Verify prerequisites**
   - Check `gh` CLI is authenticated: `gh auth status`
   - Check there are changes to commit: `git status --porcelain`
   - If no changes, report error and exit

3. **Report plan to user**
   - Show: branch name, title, files to be committed
   - Proceed automatically (this is a background agent)

## Phase 2: Create PR

Execute these steps in sequence:

1. **Create branch** (if not already on target branch)
   ```bash
   git checkout -b "$BRANCH"
   ```

2. **Stage all changes**
   ```bash
   git add -A
   ```

3. **Create commit** (use proper quoting to prevent injection)
   ```bash
   git commit -m "$COMMIT_MESSAGE"
   ```

4. **Push to origin**
   ```bash
   git push -u origin "$BRANCH"
   ```

5. **Create PR via gh CLI** (use proper quoting to prevent injection)
   ```bash
   # Detect default branch dynamically (don't assume master)
   DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')
   gh pr create --title "$TITLE" --body "$BODY" --base "$DEFAULT_BRANCH"
   ```
   - Capture the PR URL from output
   - Store PR number for polling

6. **Extract owner and repo for API calls**
   ```bash
   OWNER=$(gh repo view --json owner --jq '.owner.login')
   REPO=$(gh repo view --json name --jq '.name')
   ```

## Phase 3: Poll for Reviews

Poll for review status every 2 minutes, up to 5 cycles (10 minutes total).

### Polling Loop

For each cycle (1 to 5):

1. **Wait 2 minutes** (120 seconds)
   - On first cycle, report: "Waiting for reviews... (cycle 1/5)"

2. **Check PR review status**
   ```bash
   gh pr view <pr_number> --json reviews,comments,state
   ```

3. **Check for Greptile comments**
   ```bash
   gh api repos/$OWNER/$REPO/pulls/<pr_number>/comments
   ```
   - Greptile comments come from user "greptile-apps[bot]"
   - Actionable comment types (require code changes): logic, syntax, security
   - Informational comment types (acknowledge but may not need auto-fix): info, notes, advice

4. **Process Greptile feedback** (if found)
   - See "Handling Greptile Feedback" section below
   - After addressing feedback, push changes and continue polling

5. **Check for human approval**
   ```bash
   gh pr view <pr_number> --json reviews --jq '.reviews[] | select(.state == "APPROVED")'
   ```
   - If approved by a human reviewer, proceed to Phase 4 (Merge)

6. **Report cycle status**
   - "Cycle X/5: No reviews yet" or
   - "Cycle X/5: Addressed Greptile feedback, pushed changes" or
   - "Cycle X/5: Awaiting human approval"

### Handling Greptile Feedback

When Greptile comments are found:

1. **Analyze the feedback**
   - Read each comment's body and file location
   - Categorize by type: logic, syntax, style, security, etc.
   - Prioritize: security > logic > syntax > style

2. **For each actionable comment**:
   a. Read the relevant file section
   b. Understand the issue being flagged
   c. Implement the fix
   d. Stage the change

3. **Commit and push fixes**
   ```bash
   git add -A
   git commit -m "fix: address Greptile review feedback"
   git push
   ```

4. **Reply to Greptile comments** (add PR comment acknowledging fixes)
   ```bash
   gh pr comment <pr_number> --body "Addressed Greptile feedback in latest commit."
   ```

5. **Continue polling** for human approval

## Phase 4: Merge (On Human Approval)

When a human approves the PR:

1. **Verify approval**
   ```bash
   gh pr view <pr_number> --json reviews --jq '.reviews[] | select(.state == "APPROVED") | .author.login'
   ```

2. **Wait for CI checks to pass**
   ```bash
   gh pr checks <pr_number> --watch
   ```
   - This blocks until all checks complete
   - If any check fails, report and exit without merging

3. **Merge the PR**
   ```bash
   gh pr merge <pr_number> --squash --delete-branch
   ```
   - Use squash merge to keep history clean
   - Delete the branch after merge

4. **Report success**
   - "PR #<number> merged successfully by approval from @<reviewer>"
   - Include link to merged PR

## Phase 5: Timeout Handling

If 5 polling cycles complete without human approval:

1. **Do NOT merge** - human approval is required

2. **Generate status report**:
   ```
   PR Status Report
   ================
   PR: #<number> - <title>
   URL: <pr_url>
   Branch: <branch>

   Review Activity:
   - Greptile comments: <count> (all addressed: yes/no)
   - Human reviews: <count>
   - Approval status: Pending

   Action Required:
   - PR is ready for human review
   - Please review and approve to enable merge
   ```

3. **Leave PR open** for manual handling

## Error Handling

Handle these error cases:

1. **Git errors** (branch exists, push rejected, etc.)
   - Report the specific error
   - Do not attempt automatic recovery
   - Leave state for manual intervention

2. **gh CLI errors** (auth, API limits, etc.)
   - Report the error with context
   - Suggest manual steps if applicable

3. **Merge conflicts**
   - Report: "Merge conflict detected. Manual resolution required."
   - Provide: `git fetch origin $DEFAULT_BRANCH && git rebase origin/$DEFAULT_BRANCH`
   - Exit without merging

4. **Failed CI checks**
   - Report: "CI checks failing. Cannot merge."
   - List failing checks
   - Exit without merging

## Example Usage

```
/pr-with-review --branch feature/new-tool --title "feat: add new build tool" --body "Adds support for custom build commands"
```

```
/pr-with-review --branch fix/timeout-bug --title "fix: increase gradle timeout" --commit-message "fix: increase gradle build timeout to 10 minutes"
```

## Important Notes

- This command runs as a background agent - it will poll automatically
- Human approval is REQUIRED for merge - this is a safety constraint
- Greptile feedback is addressed automatically when possible
- All git operations use conventional commit format
- Branch must follow project naming conventions (feature/, fix/, docs/, refactor/, chore/)
