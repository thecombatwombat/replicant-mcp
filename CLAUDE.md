# replicant-mcp

Android MCP server for AI-assisted Android development.

## Quick Start

```bash
npm install
npm run build
npm start
```

## Tool Categories

- **gradle-*** - Build and test Android apps
- **emulator-device** - Manage Android emulators
- **adb-*** - Device and app control
- **ui** - Accessibility-first UI automation
- **cache** - Manage response cache
- **rtfm** - On-demand documentation

## Key Patterns

1. **Progressive Disclosure**: Tools return summaries with cache IDs. Use `*-get-details` for full output.
2. **Single Device Focus**: Use `adb-device list` then `adb-device select` to choose active device.
3. **Accessibility-First**: Prefer `ui dump` over screenshots for UI interaction.

## Common Workflows

**Build and install:**
```
gradle-list { operation: "variants" }
gradle-build { operation: "assembleDebug" }
adb-app { operation: "install", apkPath: "..." }
```

**Debug crash:**
```
adb-logcat { package: "com.example", level: "error", lines: 50 }
```

**UI automation:**
```
ui { operation: "dump" }
ui { operation: "find", selector: { text: "Login" } }
ui { operation: "tap", elementIndex: 0 }
```

## Current Status

- **MCP server**: Complete and working. Published to npm as `replicant-mcp@1.0.0`.
- **CI**: Passing (87 tests).
- **Distribution**: npm + git clone. Claude Desktop and Claude Code instructions in README.

## Future Work

- **Claude Code skill layer**: Removed due to architectural issues (shell scripts depended on built CLI that wasn't available after marketplace install). Revisit with one of these approaches:
  1. Commit `dist/` to repo (quick but not ideal)
  2. Rewrite scripts to use direct adb/gradle commands (no CLI dependency)
  3. Have scripts use globally installed npm package (`npx replicant-mcp`)

## Issue Tracking (Beads)

This project uses beads for issue-driven development.

**Before brainstorming/planning:**
- Run `bd ready` and `bd list --status=in_progress`
- Present context as a clean dashboard (not raw CLI output):

```markdown
## 📋 Project Context

| | |
|---|---|
| **Project** | replicant-mcp (Android MCP server) |
| **Status** | [version], [test count] passing |
| **Recent** | [2-3 recent changes from git log] |

**Ready Issues:**
| Pri | ID | Title |
|-----|-----|-------|
| P1 | `xxx` | ... |
| P2 | `yyy` | ... |

**What would you like to brainstorm?**
```

**After design is complete:**
- Create beads issues for implementation tasks: `bd create --title="..." --type=task`
- Set dependencies if needed: `bd dep add <child> <parent>`
- Reference issue IDs in design docs and commits

**Before ending session (Landing the Plane):**
1. File remaining work as issues
2. Update issue statuses (`bd close`, `bd update --status=...`)
3. Push everything: `git pull --rebase && bd sync && git push`
4. Verify: `git status` shows "up to date with origin"

## Workflow Rules

- **No direct pushes to master**: All changes must go through pull requests
- **Branch naming**: Use prefixes:
  - `feature/` - new functionality
  - `fix/` - bug fixes
  - `docs/` - documentation only
  - `refactor/` - code restructuring without behavior change
  - `chore/` - maintenance tasks (deps, CI, tooling)
- **Branch format**: `<prefix>/<short-description>` (e.g., `feature/visual-fallback`, `fix/gradle-timeout`)

## Documentation Rules

- **Keep README roadmap in sync**: When planning new features or completing existing ones, update the "Current Features" and "Future Roadmap" tables in README.md:
  - New planned features: Add to Future Roadmap with status "Planned"
  - Completed features: Move from Future Roadmap to Current Features
  - Status values: "Planned" (next up), "Future" (later phases), "In Progress" (actively being built)
- **Update roadmap mapping**: When adding new roadmap items, also add an entry to `.github/roadmap-mapping.yml` so the PR workflow can detect when features are completed
- **Design docs**: Store in `docs/plans/` with format `YYYY-MM-DD-<topic>-design.md`
