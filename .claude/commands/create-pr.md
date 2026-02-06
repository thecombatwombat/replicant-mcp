---
allowed-tools: Bash, Task, Read, Grep, Glob, Edit, Write
description: Create a PR with automatic code simplification and complexity checks
---

Create a pull request with built-in quality gates. Follow these steps exactly:

1. **Persist plan**: Check `.claude/plans/` for a plan file relevant to current branch. If found, copy to `docs/plans/YYYY-MM-DD-<branch-topic>-design.md` and stage it.

2. **Beads validation**: Run `bd list --status=in_progress`. If no issues found, STOP and ask user to create a beads issue before proceeding.

3. **Graph check**: For each in-progress issue, verify it has a parent epic (`bd show <id>`). Warn if orphans found.

4. **Determine base branch**: Check `git log --oneline master..HEAD` to understand commits on this branch.

5. **Find changed files**: Run `git diff --name-only master...HEAD` to get all files changed vs base branch.

6. **ADR check**: Review `git diff master...HEAD` for significant decisions — architectural (new patterns, technology choices, design trade-offs) OR workflow (process changes, enforcement mechanisms, convention changes). If any found, check `DECISIONS.md` for a corresponding entry. If missing, add the entry before proceeding.

7. **Run code-simplifier**: Use the Task tool to launch the `code-simplifier` agent on changed files.

8. **Run complexity check**: Execute `scripts/check-complexity.sh`. If violations found, fix them before proceeding.

9. **Stage and commit**: If the simplifier, ADR additions, or violation fixes made changes, stage and commit them:
   ```
   git add <changed-files>
   git commit -m "refactor: simplify code and fix complexity violations"
   ```

10. **Push branch**: `git push -u origin HEAD`

11. **Create PR**: Use `gh pr create` with a descriptive title and body summarizing all commits on the branch.

If complexity violations persist after the fix attempt, report them and stop — do not create the PR.
