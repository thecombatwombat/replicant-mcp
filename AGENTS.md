# Agent Instructions

> This file provides instructions for AI coding assistants (Claude Code, Cursor, etc.) working on this project. Human contributors can ignore this file — see [CONTRIBUTING.md](CONTRIBUTING.md) instead.

## Issue Tracking

This project uses [beads](https://github.com/anthropics/beads) (`bd`) for issue tracking. Run `bd onboard` to get started.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Session Completion

When ending a work session, you **must** push all changes to the remote:

```bash
git pull --rebase
bd sync
git push
git status  # Must show "up to date with origin"
```

Work is not complete until `git push` succeeds.
