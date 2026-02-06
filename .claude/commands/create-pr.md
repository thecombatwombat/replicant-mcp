---
allowed-tools: Bash, Task, Read, Grep, Glob, Edit, Write
description: Create a PR with automatic code simplification and complexity checks
---

Create a pull request with built-in quality gates. Follow these steps exactly:

1. **Determine base branch**: Check `git log --oneline master..HEAD` to understand commits on this branch.

2. **Find changed files**: Run `git diff --name-only master...HEAD` to get all files changed vs base branch.

3. **Run code-simplifier**: Use the Task tool to launch the `code-simplifier` agent on changed files.

4. **Run complexity check**: Execute `scripts/check-complexity.sh`. If violations found, fix them before proceeding.

5. **Stage and commit**: If the simplifier or violation fixes made changes, stage and commit them:
   ```
   git add <changed-files>
   git commit -m "refactor: simplify code and fix complexity violations"
   ```

6. **Push branch**: `git push -u origin HEAD`

7. **Create PR**: Use `gh pr create` with a descriptive title and body summarizing all commits on the branch.

If complexity violations persist after the fix attempt, report them and stop — do not create the PR.
