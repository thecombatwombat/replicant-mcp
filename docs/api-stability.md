# Tool API Stability Policy

This document defines what MCP clients can rely on across replicant-mcp releases and how breaking changes are communicated.

## Versioning Alignment

replicant-mcp follows [semantic versioning](https://semver.org/):

| Version bump | Meaning                                              | Examples                                          |
| ------------ | ---------------------------------------------------- | ------------------------------------------------- |
| **Patch**    | Bug fixes, internal refactoring, doc updates         | Fix adb timeout handling, improve error messages   |
| **Minor**    | New tools, new parameters, backward-compatible changes | Add `ui screenshot` operation, add optional param |
| **Major**    | Breaking changes to tool schemas or behavior         | Rename a tool, remove a parameter, change output   |

## Stability Guarantees

### Tool Names

Tool names (e.g., `adb-shell`, `gradle-build`, `ui`) are **stable identifiers**. Renaming or removing a tool is a **breaking change** that requires a major version bump.

### Input Schema

| Change                          | Breaking? |
| ------------------------------- | --------- |
| Add new optional parameter      | No        |
| Add new required parameter      | Yes       |
| Remove a parameter              | Yes       |
| Rename a parameter              | Yes       |
| Change a parameter's type       | Yes       |
| Narrow allowed values (enum)    | Yes       |
| Widen allowed values (enum)     | No        |

### Output Shape

| Change                                | Breaking? |
| ------------------------------------- | --------- |
| Add new field to output               | No        |
| Remove a field from output            | Yes       |
| Rename a field                        | Yes       |
| Change a field's type                 | Yes       |
| Change the structure of nested output | Yes       |

### Error Codes

Error codes (e.g., `COMMAND_BLOCKED`, `NO_DEVICE_SELECTED`) are stable. Removing an error code or changing when it is emitted is a breaking change. Adding new error codes is non-breaking.

## Deprecation Policy

Before removing or renaming a tool, parameter, or output field:

1. **Announce deprecation** in the changelog with the minor release that introduces the replacement.
2. **Maintain the deprecated feature** for at least one minor version after the announcement.
3. **Remove in the next major version** with a clear migration guide in the changelog.

For example, if a parameter is deprecated in v1.5.0, it will remain functional through all 1.x releases and may be removed in v2.0.0.

## Undocumented Fields

Output may contain fields not described in tool definitions or documentation. These are **not covered by stability guarantees** and may change or disappear without notice. Clients should not rely on undocumented output fields for critical functionality.

## Cache IDs

Cache IDs returned by progressive disclosure (e.g., `cache-get-details`) are ephemeral. They are valid only for the current session and should not be persisted or shared across sessions.

## How to Track Changes

- All breaking changes are documented in [GitHub Releases](https://github.com/ABresting/replicant-mcp/releases).
- The `CHANGELOG` section of each release describes what changed, what was added, and what was removed.
- Subscribe to releases on GitHub to be notified of new versions.
