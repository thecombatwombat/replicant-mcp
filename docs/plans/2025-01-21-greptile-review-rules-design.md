# Greptile Code Review Rules Design

## Overview

Branch-specific code review rules for Greptile, enforcing different review expectations based on the branch naming convention defined in CLAUDE.md. Includes Android MCP server-specific checks for security, protocol compliance, and ecosystem awareness.

## Project-Specific Checks

### Security Patterns
- **Command injection**: All shell commands must use process-runner.ts patterns with parameterized execution
- **ADB safety**: Flag raw shell commands that bypass adb-shell tool's safety checks
- **Path validation**: Verify apkPath, module paths, and file paths are properly sanitized
- **Package names**: Must follow reverse domain pattern (com.example.*)
- **Privilege escalation**: Flag any sudo/root commands or privileged operations

### MCP Protocol Compliance
- **Tool responses**: Must return ToolError (from types/errors.ts) or structured data, never raw strings
- **Error handling**: Use ErrorCode constants, not magic strings or generic Error objects
- **Progressive disclosure**: Large outputs (>1KB) should use cache IDs via cache-manager
- **Tool naming**: Must follow 'category-action' pattern (adb-shell, gradle-build, ui-dump)
- **Schema consistency**: Tool arguments must match MCP parameter schema

### Android Ecosystem Awareness
- **Gradle/AGP compatibility**: Check for deprecated version combinations
- **API level compatibility**: Verify minSdk/targetSdk work with selected devices
- **Resource limits**: Flag emulator configs exceeding typical dev machine capabilities
- **ADB version features**: Check if new features require specific ADB versions
- **Dangerous permissions**: Flag manifest permissions requiring user consent

## Branch Types and Review Focus

### feature/* (new functionality)
- **Logic & correctness**: Verify edge cases, error conditions, and device state handling
- **Test coverage**: New tools need integration tests in tool-handlers.test.ts
- **API consistency**: Check patterns match existing tools in src/tools/ and src/adapters/
- **Documentation**: Flag if README roadmap or rtfm docs need updates
- **Security**: Command injection risks, especially in shell execution
- **Performance**: Operations must scale across multiple devices/projects

### fix/* (bug fixes)
- **Root cause**: Fix addresses actual problem, not just symptoms
- **Regression test**: Should include test that would have caught the bug
- **Error code usage**: Prefer specific ErrorCode over generic errors
- **Device compatibility**: Test fix across different Android versions/devices
- **Scope**: No drive-by changes unrelated to the fix

### docs/* (documentation only)
- **Accuracy**: Must match actual tool behavior and current API signatures
- **Clarity**: Understandable to Android developers new to the project
- **Code changes**: FLAG AS ERROR if any .ts/.json files are modified
- **Examples**: Include working examples for complex tools like ui automation
- **Sync check**: README roadmap must stay in sync with actual capabilities

### Design Documents (docs/plans/*-design.md)
- **Technical critique**: Analyze the design for flaws, edge cases, and missing error handling
- **Feasibility**: Flag unrealistic constraints (time budgets, token limits, API assumptions)
- **Integration**: How does this design interact with existing tools? What breaks?
- **Alternatives**: Are there simpler approaches that weren't considered?
- **Android specifics**: Will this work across device manufacturers, API levels, and screen sizes?
- **Testing gaps**: What's hard to test? What manual verification is needed?
- **DO NOT just summarize the design. Provide critical technical feedback.**

### refactor/* (code restructuring)
- **No behavior change**: FLAG AS ERROR if tool responses or error codes change
- **Test compatibility**: Ensure existing tests still pass without modification
- **MCP compliance**: Don't break tool naming or response patterns
- **Import paths**: Update all imports if moving files (check for .js extensions)
- **Performance**: Refactors shouldn't degrade response times

### chore/* (maintenance)
- **Dependency security**: Flag packages with known vulnerabilities
- **Android compatibility**: Major version bumps might break device support
- **Scope**: FLAG AS ERROR if src/*.ts files modified; chore is for deps/CI/tooling only
- **Build integrity**: Verify changes don't break npm publish or CI pipeline

## Configuration

File: `greptile.json` (repo root)

```json
{
  "strictness": 2,
  "commentTypes": ["info", "logic", "syntax", "style", "notes", "advice", "checks"],
  "triggerOnUpdates": true,
  "ignorePatterns": "dist/**\ncoverage/**\nnode_modules/**\n*.lock",
  "instructions": "Apply review rules based on branch prefix. Focus on Android development security, MCP protocol compliance, and progressive disclosure patterns. For design documents (docs/plans/*-design.md), provide critical technical review - do NOT just summarize or rubber-stamp.",
  "customContext": {
    "rules": [
      "ANDROID MCP SERVER SPECIFIC CHECKS:",
      "",
      "SECURITY PATTERNS:",
      "- Command injection: All shell commands must use process-runner.ts patterns with parameterized execution",
      "- ADB safety: Flag raw shell commands that bypass adb-shell tool's safety checks",
      "- Path validation: Verify apkPath, module paths, and file paths are properly sanitized",
      "- Package names: Must follow reverse domain pattern (com.example.*)",
      "- Privilege escalation: Flag any sudo/root commands or privileged operations",
      "",
      "MCP PROTOCOL COMPLIANCE:",
      "- Tool responses: Must return ToolError (from types/errors.ts) or structured data, never raw strings",
      "- Error handling: Use ErrorCode constants, not magic strings or generic Error objects",
      "- Progressive disclosure: Large outputs (>1KB) should use cache IDs via cache-manager",
      "- Tool naming: Must follow 'category-action' pattern (adb-shell, gradle-build, ui-dump)",
      "- Schema consistency: Tool arguments must match MCP parameter schema",
      "",
      "ANDROID ECOSYSTEM AWARENESS:",
      "- Gradle/AGP compatibility: Check for deprecated version combinations",
      "- API level compatibility: Verify minSdk/targetSdk work with selected devices",
      "- Resource limits: Flag emulator configs exceeding typical dev machine capabilities",
      "- ADB version features: Check if new features require specific ADB versions",
      "- Dangerous permissions: Flag manifest permissions requiring user consent",
      "",
      "FEATURE BRANCHES (feature/*):",
      "- Logic & correctness: Verify edge cases, error conditions, and device state handling",
      "- Test coverage: New tools need integration tests in tool-handlers.test.ts",
      "- API consistency: Check patterns match existing tools in src/tools/ and src/adapters/",
      "- Documentation: Flag if README roadmap or rtfm docs need updates",
      "- Security: Command injection risks, especially in shell execution",
      "- Performance: Operations must scale across multiple devices/projects",
      "",
      "FIX BRANCHES (fix/*):",
      "- Root cause: Fix addresses actual problem, not just symptoms",
      "- Regression test: Should include test that would have caught the bug",
      "- Error code usage: Prefer specific ErrorCode over generic errors",
      "- Device compatibility: Test fix across different Android versions/devices",
      "- Scope: No drive-by changes unrelated to the fix",
      "",
      "DOCS BRANCHES (docs/*):",
      "- Accuracy: Must match actual tool behavior and current API signatures",
      "- Clarity: Understandable to Android developers new to the project",
      "- Code changes: FLAG AS ERROR if any .ts/.json files are modified",
      "- Examples: Include working examples for complex tools like ui automation",
      "- Sync check: README roadmap must stay in sync with actual capabilities",
      "",
      "DESIGN DOCUMENTS (docs/plans/*-design.md):",
      "- Technical critique: Analyze the design for flaws, edge cases, and missing error handling",
      "- Feasibility: Flag unrealistic constraints (time budgets, token limits, API assumptions)",
      "- Integration: How does this design interact with existing tools? What breaks?",
      "- Alternatives: Are there simpler approaches that weren't considered?",
      "- Android specifics: Will this work across device manufacturers, API levels, and screen sizes?",
      "- Testing gaps: What's hard to test? What manual verification is needed?",
      "- DO NOT just summarize the design. Provide critical technical feedback.",
      "",
      "REFACTOR BRANCHES (refactor/*):",
      "- No behavior change: FLAG AS ERROR if tool responses or error codes change",
      "- Test compatibility: Ensure existing tests still pass without modification",
      "- MCP compliance: Don't break tool naming or response patterns",
      "- Import paths: Update all imports if moving files (check for .js extensions)",
      "- Performance: Refactors shouldn't degrade response times",
      "",
      "CHORE BRANCHES (chore/*):",
      "- Dependency security: Flag packages with known vulnerabilities",
      "- Android compatibility: Major version bumps might break device support",
      "- Scope: FLAG AS ERROR if src/*.ts files modified; chore is for deps/CI/tooling only",
      "- Build integrity: Verify changes don't break npm publish or CI pipeline",
      "",
      "UNKNOWN BRANCH PREFIX: Flag as convention violation. Must use feature/, fix/, docs/, refactor/, or chore/"
    ],
    "files": [
      {
        "path": "CLAUDE.md",
        "description": "Project conventions, workflow rules, and current status"
      }
    ]
  }
}
```

## Design Decisions

1. **Strictness 2**: Balanced - not too noisy, not too quiet
2. **All comment types enabled**: info, logic, syntax, style, notes, advice, checks
3. **triggerOnUpdates**: Re-reviews when PR is updated
4. **Unknown prefixes flagged**: Enforces branch naming convention
5. **Ignore patterns**: Build artifacts, coverage reports, lock files excluded from review
6. **Project-specific checks**: Security, MCP compliance, and Android ecosystem rules front-loaded

## Implementation

1. Create `greptile.json` in repo root with the configuration above
2. Greptile will automatically pick up the config on next PR
