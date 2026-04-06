# replicant-mcp

Android MCP server for AI-assisted Android development. Published to npm as `replicant-mcp`.

## Decision Log

Check `DECISIONS.md` before making architectural or workflow choices. Add entries for significant decisions.

## Issue Tracking

- **Backlog lives in Linear. Never create backlog items, epics, or feature requests in beads.**
- **Beads is working memory only.** Use it for cross-session tasks you are actively working on — 3-5 items max. Close immediately when done. Do not accumulate issues.
- Scope all Linear issues to the **replicant-mcp** project only.

## MCP Resources

- **Context7**: Use for library/API docs, code examples, and configuration guidance.
- **Linear**: Use for backlog and roadmap (see Issue Tracking above).

## Code Health

- File limit: 500 lines. Function limit: 80 lines. CLI command builders (`src/cli/`) excluded.
- Tool operations are separate named functions; main handler dispatches.
- No module-level mutable state. Use ServerContext.
- Use ReplicantError. Never swallow errors silently.

## Testing

- Coverage enforced via thresholds in `vitest.config.ts`. Run `npm run test:coverage` before PR.
- Test before implement. Unit tests in `tests/<category>/`, integration in `tests/integration/`.
- Cover happy paths, error cases, edge cases, retries, boundaries, and mock external deps.

## Privacy Policy

`PRIVACY.md` documents what data replicant-mcp accesses and where it goes. Review and update it when:
- Adding new data sources (new ADB data types, network traffic, file system access)
- Adding any external network calls, telemetry, or analytics
- Changing data persistence behavior (caching, logging to disk)
- Adding new third-party dependencies that process user data
- Changing how data flows to the AI assistant

When in doubt, flag the PR with a comment noting the privacy policy may need review.

## PR & Branches

- **Never push directly to master. No exceptions, no matter how small the change.** Always create a branch and use `/create-pr`.
- Branch format: `<prefix>/<short-description>`
- Prefixes: `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`, `trivial/`
- Monitor for Greptile review. Wait for human approval before merging.

## Releasing

Use `/release` — never manually bump, tag, or publish.
