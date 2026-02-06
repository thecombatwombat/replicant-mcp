---
allowed-tools: Bash, Read, Grep, Glob
description: Generate a full codebase health dashboard
---

Generate a comprehensive codebase health report by running these checks:

1. **Complexity violations**: Run `scripts/check-complexity.sh` and capture output
2. **Module sizes**: Count files and lines per module (`src/tools/`, `src/services/`, `src/adapters/`, `src/types/`, `src/parsers/`, `src/utils/`)
3. **Type safety**: Count occurrences of `as any`, `as unknown`, `Record<string, unknown>` return types, and `[key: string]: unknown` in `src/`
4. **Global mutable state**: Search for `let ` at module level in `src/` (not inside functions/classes)
5. **Test ratio**: Count total lines in `src/` and `tests/`, calculate test-to-source ratio
6. **Top 5 largest files**: List the 5 largest `.ts` files in `src/` by line count
7. **Top 5 largest functions**: Use the complexity script output or manual search

Present results as a markdown table dashboard:

```markdown
## Codebase Health Report

| Dimension | Rating | Details |
|-----------|--------|---------|
| Module boundaries | ... | ... |
| File sizes | ... | ... |
| Test coverage | ... | ... |
| Type safety | ... | ... |
| Complexity hotspots | ... | ... |
| Global state | ... | ... |

### Top 5 Largest Files
| File | Lines |
|------|-------|
| ... | ... |

### Violations
(list from check-complexity.sh, or "None")
```

Rate each dimension as Excellent / Good / Fair / Needs Work based on:
- File sizes: Excellent if all <200, Good if all <300, Fair if 1-2 over, Needs Work if 3+
- Type safety: Excellent if 0 unsafe casts, Good if <3, Fair if <10, Needs Work if 10+
- Test ratio: Excellent if >0.8, Good if >0.5, Fair if >0.3, Needs Work if <0.3
