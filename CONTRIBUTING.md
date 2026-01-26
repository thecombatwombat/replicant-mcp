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
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `npm run validate` to ensure tests pass
5. Commit with a descriptive message
6. Push and open a PR
