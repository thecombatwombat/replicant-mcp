# Test Regression Detection Design

**Issue:** `replicant-mcp-3wk.1`
**Branch:** `feature/test-regression`
**Wave:** 2

## Overview

Store test baselines and compare subsequent runs to flag regressions. Closes the fix-verify loop: after making changes, an agent runs tests and immediately sees if anything regressed.

## Storage

- Location: `.replicant/test-baselines/{task-name}.json`
- Already gitignored (`.replicant/` in `.gitignore`)
- Keyed by Gradle test task name (e.g., `testDebugUnitTest`)

## Baseline Format

```typescript
interface TestBaseline {
  savedAt: string;        // ISO 8601 timestamp
  task: string;           // Gradle task name
  results: TestResult[];
}

interface TestResult {
  test: string;           // Fully qualified test name
  status: "pass" | "fail" | "skip";
}

interface Regression {
  test: string;
  previousStatus: string;
  currentStatus: string;
}
```

## Service API

Create `src/services/test-baseline.ts`:

```typescript
export function saveBaseline(taskName: string, results: TestResult[]): void
// Write baseline JSON to .replicant/test-baselines/{taskName}.json

export function loadBaseline(taskName: string): TestBaseline | null
// Read baseline or return null if not saved

export function clearBaseline(taskName: string): void
// Delete baseline file

export function compareResults(baseline: TestBaseline, current: TestResult[]): Regression[]
// Return list of regressions: tests that passed in baseline but fail/skip now
```

## gradle-test Integration

Extend `src/tools/gradle-test.ts`:

1. **After running tests:** If a baseline exists for the task, auto-compare and include `regressions` in response:
   ```typescript
   // In test result handler, after parsing results:
   const baseline = loadBaseline(taskName);
   const regressions = baseline ? compareResults(baseline, currentResults) : [];
   return {
     ...existingResponse,
     regressions,  // empty array if no baseline or no regressions
   };
   ```

2. **New operations** (add to gradle-test's operation dispatch):
   - `saveBaseline`: Save current test results as baseline
   - `clearBaseline`: Remove saved baseline for a task

## Files

| File | Action |
|------|--------|
| `src/services/test-baseline.ts` | Create |
| `src/tools/gradle-test.ts` | Extend with regressions + new operations |

## Tests

`tests/services/test-baseline.test.ts`:
- Save and load roundtrip
- Load returns null when no baseline exists
- Clear removes the file
- Compare detects regressions (pass → fail)
- Compare ignores improvements (fail → pass)
- Compare handles new tests not in baseline
- Compare handles removed tests

## Coverage Note

Agent 9 (Wave 3, output schemas) will define the gradle-test output schema AFTER this merges. The `regressions` field should be defined as optional in that schema since it only appears when a baseline exists.

## Pre-PR

- `npm run test:coverage` — all 4 thresholds must pass
- `npm run check-complexity`
