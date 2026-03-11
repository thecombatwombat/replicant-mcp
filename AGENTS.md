# replicant-mcp

Android MCP server for AI-assisted Android development. Published to npm as `replicant-mcp`.

## Decision Log

Check `DECISIONS.md` before making architectural or workflow choices. Add entries for significant decisions.

## MCP Resources

- **Context7**: Use for library/API docs, code examples, and configuration guidance.
- **Linear**: Scope all issues to the **replicant-mcp** project only.

## Code Health

- File limit: 500 lines. Function limit: 80 lines. CLI command builders (`src/cli/`) excluded.
- Tool operations are separate named functions; main handler dispatches.
- No module-level mutable state. Use ServerContext.
- Use ReplicantError. Never swallow errors silently.

## Testing

- Coverage enforced via thresholds in `vitest.config.ts`. Run `npm run test:coverage` before PR.
- Test before implement. Unit tests in `tests/<category>/`, integration in `tests/integration/`.
- Cover happy paths, error cases, edge cases, retries, boundaries, and mock external deps.

## PR & Branches

- **Never push directly to master. No exceptions, no matter how small the change.** Always create a branch and use `/create-pr`.
- Branch format: `<prefix>/<short-description>`
- Prefixes: `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`, `trivial/`
- Monitor for Greptile review. Wait for human approval before merging.

## Releasing

Use `/release` — never manually bump, tag, or publish.
