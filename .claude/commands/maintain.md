---
description: "Run project maintenance checks and fix issues"
allowed-tools: ["Bash", "Read", "Edit", "Glob", "Grep"]
---

# Project Maintenance

Run health checks and fix what you can. Report what needs manual action.

## Step 1: Run checks

```bash
bash scripts/maintain.sh
```

## Step 2: Act on results

For each warning:

1. **Tool version mismatch** — If bd or gh is outdated locally, update `.tool-versions` and reinstall. If it's a remote-only issue, note it.
2. **bd doctor warnings** — Run `bd doctor --fix` (pipe `echo Y` for confirmation). For unfixable items, report them.
3. **Uncommitted changes** — List the files. Ask if the user wants to commit or stash.
4. **Unpushed commits** — Ask if the user wants to push.
5. **Stale worktrees** — List them. Ask if the user wants to clean up.
6. **node_modules missing** — Run `npm install`.

## Step 3: Verify

Run `bash scripts/maintain.sh` again to confirm all warnings are resolved. Report any remaining issues that need manual action (like plugin updates).
