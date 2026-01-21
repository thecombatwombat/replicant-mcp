# npm Publishing Design for replicant-mcp

## Overview

Enable users to install the MCP server via npm without cloning the repository.

## User Experience

**Installation:**
```bash
npm install -g replicant-mcp
```

**Claude Desktop Configuration:**
```json
{
  "mcpServers": {
    "replicant": {
      "command": "replicant-mcp"
    }
  }
}
```

## Implementation

### 1. Add Shebang to Entry Point

`src/index.ts` first line:
```typescript
#!/usr/bin/env node
```

This makes the compiled `dist/index.js` executable as a CLI command.

### 2. Add `files` Field to package.json

```json
{
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ]
}
```

This ensures only necessary files are published (no source, tests, docs/plans, etc.).

### 3. Add `prepublishOnly` Script

```json
{
  "scripts": {
    "prepublishOnly": "npm run build && npm test"
  }
}
```

Prevents publishing broken code.

### 4. Post-Build Permission Fix (if needed)

Ensure `dist/index.js` has executable permissions after TypeScript compilation.

## What Gets Published

- `dist/` - Compiled JavaScript
- `README.md` - Documentation
- `LICENSE` - MIT license
- `package.json` - Package metadata

## What Does NOT Get Published

- `src/` - TypeScript source
- `tests/` - Test files
- `docs/` - Design documents
- `skills/` - Claude Code skill (separate distribution)
- `scripts/` - Development scripts

## Prerequisites (User Responsibility)

Users must have:
- Node.js 18+
- Android SDK with `adb` and `emulator` in PATH
- Android project with `gradlew` (for build operations)

These are documented in README.md.

## Publishing Workflow

```bash
# One-time: login to npm
npm login

# Publish (runs prepublishOnly automatically)
npm publish
```

## Future: Automated Publishing

Could add GitHub Actions to publish on version tags:
```yaml
on:
  push:
    tags: ['v*']
```

This is out of scope for initial implementation.
