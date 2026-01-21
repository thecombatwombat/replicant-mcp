# Custom Build Commands

**Status:** Design complete
**Epic:** Custom Build Commands
**Created:** 2025-01-21

## Overview

Allow projects to override replicant's default build behavior, either through a custom skill (for complex projects) or through smart defaults (for simple projects).

## Goals

- Support custom skill override for builds - replicant fully defers
- Smart defaults when unconfigured - auto-detect `gradlew` vs `gradle`
- Use existing config infrastructure (`REPLICANT_CONFIG`)

## Non-goals (for now)

- Test/lint/other gradle operations
- Server-side fallback chains (skill handles that)
- Build caching or optimization

## Future Work

- Extend skill override pattern to other gradle operations (test, lint, etc.)
- Potentially any gradle task could defer to project config

## Design Principle

When a custom skill is configured, replicant gets out of the way entirely. No guessing, no fallbacks. The skill owns build logic.

## Configuration

Extends the existing `replicant.yaml` config:

```yaml
ui:
  # ... visual fallback config

build:
  # Path to custom skill that handles builds (optional)
  # When set, replicant defers entirely to this skill
  skillPath: ".claude/skills/build.md"

  # OR for simpler overrides without a full skill:
  # Gradle binary to use (auto-detected if not set)
  gradleBinary: "./gradlew"

  # Default variant (used when LLM doesn't specify)
  defaultVariant: "stagingDebug"
```

**Precedence:**
1. If `skillPath` is set → replicant tells LLM to use that skill, does nothing itself
2. If `gradleBinary` / `defaultVariant` set → use those values
3. If nothing set → smart defaults (auto-detect gradlew, use `debug` variant)

**Auto-detection logic:**
```
if ./gradlew exists and is executable → use ./gradlew
else if gradle is on PATH → use gradle
else → error with helpful message
```

## Tool Behavior

### When `build.skillPath` is configured

The `gradle-build` tool returns immediately with a delegation message:

```json
{
  "delegated": true,
  "skillPath": ".claude/skills/build.md",
  "message": "Build is handled by project-specific skill. Use the skill at .claude/skills/build.md instead.",
  "requestedOperation": "assembleDebug"
}
```

The LLM is expected to invoke the skill instead. Replicant does not execute any build commands.

### When `build.skillPath` is NOT configured

The `gradle-build` tool works as today, but with smart defaults:

1. Auto-detect gradle binary (gradlew preferred)
2. Use `defaultVariant` from config if set
3. Execute the build command
4. Return results as usual

### Tool description update

The `gradle-build` tool description should mention:
- "This tool may be overridden by project config. Check response for `delegated: true`."

## Implementation

**Files to modify:**

1. `src/types/index.ts` - Add `BuildConfig` interface
2. `src/config.ts` - Add `build` section to config parsing
3. `src/tools/gradle-build.ts` - Check for skillPath, auto-detect binary, apply defaultVariant
4. `src/utils/gradle.ts` (new or extend) - `detectGradleBinary()`, `isGradlewPresent()`

**Tests to add:**
- Skill delegation response when `skillPath` configured
- Auto-detection of gradlew vs gradle
- `defaultVariant` applied correctly
- Config precedence (skillPath > gradleBinary > auto-detect)

## Summary

| Scenario | Behavior |
|----------|----------|
| `build.skillPath` set | Delegate entirely to skill, return delegation message |
| `build.gradleBinary` set | Use specified binary |
| `build.defaultVariant` set | Use as default when LLM doesn't specify |
| Nothing configured | Auto-detect gradlew > gradle, use `debug` variant |
