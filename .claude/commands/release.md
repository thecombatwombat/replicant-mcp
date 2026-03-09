---
description: Release a new version (patch/minor/major)
allowed-tools: Bash
---

Run the release script: `./scripts/release.sh $ARGUMENTS`

If no arguments provided, default to `--dry-run` and show the user what would happen. Ask for confirmation before running without `--dry-run`.

Valid arguments: `patch`, `minor`, `major`, `--dry-run` (can combine, e.g. `minor --dry-run`)
