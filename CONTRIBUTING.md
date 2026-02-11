# Contributing to replicant-mcp

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/thecombatwombat/replicant-mcp.git
cd replicant-mcp
npm install
npm run build
npm test
```

## Project Structure

```
src/
  index.ts           # Entry point
  server.ts          # MCP server setup
  tools/             # Tool implementations (one file per tool)
  adapters/          # CLI wrappers (adb, emulator, gradle)
  services/          # Core services (cache, device state, process runner)
  parsers/           # Output parsers
  types/             # TypeScript types
docs/rtfm/           # On-demand documentation
tests/               # Unit and integration tests
scripts/             # Utility scripts
```

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (MCP protocol compliance)
npm run test:integration

# With coverage
npm run test:coverage

# Full validation (build + all tests)
npm run validate
```

## Checking Prerequisites

```bash
npm run check-prereqs
```

This verifies your Android SDK setup and reports what's available.

## Submitting Changes

1. Fork the repo
2. Create a feature branch (see [Branch Naming](#branch-naming) below)
3. Make your changes
4. Run `npm run validate` to ensure tests pass
5. Commit using [conventional commit](#commit-conventions) format
6. Push and open a PR

## Code Standards

These are enforced by CI and pre-push checks:

- **File limit**: 500 lines per file. **Function limit**: 80 lines per function.
- **Tool operations** must be separate named functions; the main handler dispatches to them.
- **Error handling**: Use `ReplicantError` for all errors. Never swallow errors silently.
- **No module-level mutable state**. Use `ServerContext` for shared state.

Before submitting, verify your changes pass complexity checks:

```bash
npm run check-complexity
```

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must start with a type prefix:

| Prefix | Use for |
|---|---|
| `feat:` | New features or capabilities |
| `fix:` | Bug fixes |
| `refactor:` | Code restructuring without behavior change |
| `docs:` | Documentation only |
| `chore:` | Maintenance tasks (deps, CI, tooling) |
| `test:` | Adding or updating tests |

Keep commits atomic and focused -- one logical change per commit.

**Examples:**

```
feat: add video capture for UI automation
fix: correct gradle timeout cap
refactor: extract device selection into shared helper
docs: update installation steps for Claude Desktop
test: add coverage for logcat filtering edge cases
```

## Branch Naming

Branches must use one of these prefixes:

| Prefix | Use for |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring without behavior change |
| `chore/` | Maintenance tasks (deps, CI, tooling) |
| `trivial/` | Typos, minor doc fixes |

Format: `<prefix>/<short-description>`

**Examples:**

```
feature/visual-fallback
fix/gradle-timeout
docs/update-readme
refactor/extract-device-state
chore/upgrade-vitest
```
