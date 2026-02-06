---
description: "Check dev environment health: tool versions, git state, beads, build"
allowed-tools: ["Bash", "Read", "Edit", "Glob", "Grep"]
---

# Check Dev Environment

Run environment health checks and fix what you can. Report what needs manual action.

## Step 1: Run checks

```bash
bash scripts/check-env.sh
```

## Step 2: Act on results

For each warning:

1. **Tool version mismatch** — If bd or gh is outdated locally, update `.tool-versions` and reinstall. If it's a remote-only issue, note it.
2. **Plugin version mismatch** — Tell the user to run `/plugin update beads@beads-marketplace`.
3. **bd doctor warnings** — Run `bd doctor --fix` (pipe `echo Y` for confirmation). For unfixable items, report them.
4. **Uncommitted changes** — List the files. Ask if the user wants to commit or stash.
5. **Unpushed commits** — Ask if the user wants to push.
6. **Stale worktrees** — List them. Ask if the user wants to clean up.
7. **node_modules missing** — Run `npm install`.

## Step 3: Verify

Run `bash scripts/check-env.sh` again to confirm all warnings are resolved. Report any remaining issues that need manual action.
