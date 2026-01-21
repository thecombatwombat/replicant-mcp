# Skills Marketplace Design for replicant-mcp

## Overview

Enable users to install the replicant-dev skill via Claude Code's plugin marketplace system.

## User Experience

**Add marketplace (one-time):**
```bash
/plugin marketplace add thecombatwombat/replicant-mcp
```

**Install skill:**
```bash
/plugin install replicant-dev@replicant-mcp
```

## Implementation

### 1. Create `.claude-plugin/marketplace.json`

```json
{
  "name": "replicant-mcp",
  "owner": {
    "name": "Archit Joshi"
  },
  "metadata": {
    "description": "Android development tools for Claude Code",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "replicant-dev",
      "source": "../skills/replicant-dev",
      "description": "Android development skill - build APKs, manage emulators, automate UI",
      "version": "1.0.0",
      "author": {
        "name": "Archit Joshi"
      },
      "repository": "https://github.com/thecombatwombat/replicant-mcp",
      "license": "MIT",
      "keywords": ["android", "adb", "gradle", "emulator", "ui-automation"],
      "category": "development"
    }
  ]
}
```

### 2. Create `.claude-plugin/plugin.json`

This is required for the plugin to be recognized:

```json
{
  "name": "replicant-dev",
  "version": "1.0.0",
  "description": "Android development skill for Claude Code",
  "skills": ["replicant-dev"]
}
```

### 3. Update `skills/replicant-dev/SKILL.md` Frontmatter

Ensure the SKILL.md has proper frontmatter for plugin discovery:

```yaml
---
name: replicant-dev
description: Android development automation - build, test, emulators, UI
---
```

## Directory Structure After Changes

```
replicant-mcp/
├── .claude-plugin/
│   ├── marketplace.json    # NEW - Marketplace catalog
│   └── plugin.json         # NEW - Plugin manifest
├── skills/
│   └── replicant-dev/
│       ├── SKILL.md        # EXISTS - Skill manifest
│       └── *.sh            # EXISTS - Shell scripts
└── ...
```

## What Gets Installed

When a user runs `/plugin install replicant-dev@replicant-mcp`:
- The `skills/replicant-dev/` directory is installed to their Claude Code skills
- All shell scripts are available
- The CLI (`dist/cli.js`) is referenced via the scripts

## Prerequisites Note

Users still need:
- Node.js 18+
- Android SDK with `adb` and `emulator` in PATH
- The npm package installed (`npm install -g replicant-mcp`) for the CLI

This should be documented in the skill's SKILL.md.

## Alternative: Standalone Skill Distribution

If users don't want the full MCP server, they could:
1. Clone just the skill files
2. Run `npm run install-skill` locally

The marketplace approach is additive - both distribution methods work.
