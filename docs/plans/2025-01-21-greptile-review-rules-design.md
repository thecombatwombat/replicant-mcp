# Greptile Code Review Rules Design

## Overview

Branch-specific code review rules for Greptile, enforcing different review expectations based on the branch naming convention defined in CLAUDE.md.

## Branch Types and Review Focus

### feature/* (new functionality)
- **Logic & correctness**: Verify implementation handles edge cases and error conditions
- **Test coverage**: New functionality must have corresponding tests
- **API design**: Check consistency with existing patterns in src/tools/ and src/adapters/
- **Documentation**: Flag if README roadmap or CLAUDE.md needs updating
- **Security**: Check for command injection risks, especially in adb-shell and process execution
- **Performance**: Flag obvious inefficiencies or operations that don't scale

### fix/* (bug fixes)
- **Root cause**: Verify the fix addresses the actual problem, not just symptoms
- **Regression test**: There should be a test that would have caught this bug
- **Scope**: Flag any changes not directly related to the fix (no drive-by refactors)
- **Issue reference**: PR description should reference the issue being fixed
- **Side effects**: Check if the fix could break other functionality

### docs/* (documentation only)
- **Accuracy**: Documentation must match actual tool behavior and API signatures
- **Clarity**: Should be understandable to someone new to the project
- **Code changes**: FLAG AS ERROR if any non-documentation files are modified
- **Completeness**: Examples should be included for non-obvious usage
- **Links**: Check for broken references to other docs or code

### refactor/* (code restructuring)
- **No behavior change**: FLAG AS ERROR if any functional behavior appears to change
- **Testability improved**: Refactors should make code easier to test; flag if coverage decreases
- **No new features**: Refactors restructure existing code, they don't add capabilities
- **Readability**: The refactored code should be clearer than before
- **Focused changes**: Flag unrelated cleanup or formatting outside the refactor scope

### chore/* (maintenance)
- **Security**: Flag dependency updates that introduce known vulnerabilities
- **Breaking changes**: Flag major version bumps; verify compatibility
- **Scope**: FLAG AS ERROR if application code (src/*.ts) is modified
- **CI integrity**: Check that workflow changes won't break the build pipeline

## Configuration

File: `greptile.json` (repo root)

```json
{
  "strictness": 2,
  "commentTypes": ["logic", "syntax", "style", "advice"],
  "triggerOnUpdates": true,
  "ignorePatterns": "dist/**\ncoverage/**\nnode_modules/**\n*.lock",
  "instructions": "Apply review rules based on branch prefix (feature/, fix/, docs/, refactor/, chore/). Unknown prefixes should be flagged as a convention violation.",
  "customContext": {
    "rules": [
      "FEATURE BRANCHES (feature/*):",
      "- Logic & correctness: Verify the implementation handles edge cases and error conditions",
      "- Test coverage: New functionality must have corresponding tests",
      "- API design: Check consistency with existing patterns in src/tools/ and src/adapters/",
      "- Documentation: Flag if README roadmap or CLAUDE.md needs updating for new capabilities",
      "- Security: Check for command injection risks, especially in adb-shell and process execution",
      "- Performance: Flag obvious inefficiencies or operations that don't scale",
      "",
      "FIX BRANCHES (fix/*):",
      "- Root cause: Verify the fix addresses the actual problem, not just symptoms",
      "- Regression test: There should be a test that would have caught this bug",
      "- Scope: Flag any changes that aren't directly related to the fix (no drive-by refactors or features)",
      "- Issue reference: PR description should reference the issue being fixed",
      "- Side effects: Check if the fix could break other functionality, especially in shared services like cache or device state",
      "",
      "DOCS BRANCHES (docs/*):",
      "- Accuracy: Documentation must match actual tool behavior and API signatures",
      "- Clarity: Should be understandable to someone new to the project",
      "- Code changes: FLAG AS ERROR if any non-documentation files are modified (.ts, .json config, etc.)",
      "- Completeness: Examples should be included for non-obvious usage",
      "- Links: Check for broken references to other docs or code",
      "",
      "REFACTOR BRANCHES (refactor/*):",
      "- No behavior change: FLAG AS ERROR if any functional behavior appears to change",
      "- Testability improved: Refactors should make code easier to test; flag if test coverage decreases",
      "- No new features: Refactors restructure existing code, they don't add capabilities",
      "- Readability: The refactored code should be clearer than before",
      "- Focused changes: Flag unrelated cleanup or formatting outside the refactor scope",
      "",
      "CHORE BRANCHES (chore/*):",
      "- Security: Flag dependency updates that introduce known vulnerabilities",
      "- Breaking changes: Flag major version bumps; verify compatibility",
      "- Scope: FLAG AS ERROR if application code (src/*.ts) is modified; chore is for deps/CI/tooling only",
      "- CI integrity: Check that workflow changes won't break the build pipeline",
      "",
      "UNKNOWN BRANCH PREFIX: Flag as convention violation. All branches must use feature/, fix/, docs/, refactor/, or chore/ prefix."
    ],
    "files": [
      { "path": "CLAUDE.md", "description": "Project conventions and patterns" }
    ]
  }
}
```

## Design Decisions

1. **Strictness 2**: Balanced - not too noisy, not too quiet
2. **triggerOnUpdates**: Re-reviews when PR is updated
3. **Unknown prefixes flagged**: Enforces branch naming convention
4. **Ignore patterns**: Build artifacts, coverage reports, lock files excluded from review
5. **Natural language rules**: Greptile's AI interprets branch-specific guidelines contextually

## Implementation

1. Create `greptile.json` in repo root with the configuration above
2. Greptile will automatically pick up the config on next PR
