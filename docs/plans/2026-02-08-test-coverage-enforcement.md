# Fix Shallow Testing Problem with Coverage Enforcement

## Context

The insights report identified "shallow testing" as the #1 friction pattern — Claude repeatedly writes only happy-path smoke tests instead of comprehensive tests covering failure paths, edge cases, and retry logic. This causes test failures in CI and requires multiple correction cycles.

**Current state:**
- 272 tests passing with 68.71% line coverage (60.49% branch, 63.17% function)
- Coverage collected but NOT enforced — no thresholds configured
- Tools have very low coverage (41.6%): adb-device 6.66%, gradle-list 11.11%, emulator-device 5.45%
- Services well-tested (95.21%), utils at 100%

**User's requirement:** Use real code coverage enforcement + CI checks, not naive "did test files change?" hooks. Must handle doc/chore commits properly without false positives.

## Solution

Three-layer approach:

1. **Vitest configuration** — Add coverage thresholds that make tests fail when coverage drops
2. **CI enforcement** — Make CI fail when thresholds aren't met (but skip for doc-only changes)
3. **CLAUDE.md standards** — Explicit testing expectations so Claude writes proper tests upfront

## Implementation

### 0. Create beads structure and persist plan

**a) Persist this plan:**
```bash
cp ~/.claude/plans/harmonic-dancing-mountain.md docs/plans/2026-02-08-test-coverage-enforcement.md
```

**b) Create parent issue for this implementation:**
```bash
bd create \
  --title="Implement test coverage enforcement" \
  --type=task \
  --priority=1 \
  --description="[Plan: docs/plans/2026-02-08-test-coverage-enforcement.md]

Implement Vitest coverage thresholds and CI enforcement to prevent test coverage regression.

**Deliverables:**
- vitest.config.ts with thresholds (68/60/63/70)
- CI skips coverage on doc-only changes
- CLAUDE.md updated with testing standards
- DECISIONS.md updated with ADR
- Verified locally with npm run test:coverage

**Blocks:** Epic for 90% coverage improvement (depends on this foundation)
"
```
Note the parent issue ID as `<parent-id>`.

**c) Create child tasks for implementation steps:**
```bash
# Task 1: vitest.config.ts
bd create --parent=<parent-id> \
  --title="Create vitest.config.ts with coverage thresholds" \
  --type=task \
  --priority=1 \
  --description="Create vitest config with thresholds: 68% lines, 60% branches, 63% functions, 70% statements"

# Task 2: CI workflow
bd create --parent=<parent-id> \
  --title="Update CI to skip coverage on doc-only changes" \
  --type=task \
  --priority=1 \
  --description="Add git diff check in ci.yml to skip coverage when only docs/README/non-src files changed"

# Task 3: CLAUDE.md
bd create --parent=<parent-id> \
  --title="Update CLAUDE.md with testing standards" \
  --type=task \
  --priority=1 \
  --description="Add Testing Standards section referencing vitest.config.ts for thresholds"

# Task 4: DECISIONS.md
bd create --parent=<parent-id> \
  --title="Update DECISIONS.md with coverage enforcement ADR" \
  --type=task \
  --priority=1 \
  --description="Document decision, rationale, thresholds, and migration strategy"

# Task 5: Verification
bd create --parent=<parent-id> \
  --title="Verify coverage enforcement works locally and in CI" \
  --type=task \
  --priority=1 \
  --description="Run npm run test:coverage locally, create test PR to verify CI behavior"
```

**d) Mark parent as in_progress and start work:**
```bash
bd update <parent-id> --status=in_progress
```

### 1. Create vitest.config.ts

**New file:** `/Users/architjoshi/code/claude/replicant-mcp/vitest.config.ts`

Set thresholds at current baseline (rounded to nearest 5%) to lock in existing coverage and prevent any regression:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  coverage: {
    provider: 'v8',
    enabled: false,  // Only enable with --coverage flag
    include: ['src/**/*.ts'],
    exclude: [
      'src/**/index.ts',      // Barrel exports
      'src/types/**',         // Type definitions
      '**/*.d.ts',
      'tests/**'
    ],
    reportsDirectory: './coverage',
    reporter: ['text', 'html', 'json-summary', 'clover'],

    thresholds: {
      lines: 68,        // Current: 68.71%
      branches: 60,     // Current: 60.49%
      functions: 63,    // Current: 63.17%
      statements: 70,   // Current: 70.1%
      perFile: false
    }
  }
});
```

**Why these thresholds:** Current coverage is 68.71% lines, 60.49% branches, 63.17% functions, 70.1% statements. Setting thresholds at current baseline locks existing coverage and prevents any regression. These will be incrementally increased as low-coverage modules (tools at 41.6%) are improved to 90%+.

**Behavior:** When `npm test -- --run --coverage` runs, Vitest will:
- Collect coverage using V8 provider
- Check against thresholds
- Exit non-zero if below threshold (fails CI automatically)
- Generate reports in `coverage/` directory

### 2. Update CI to skip coverage on doc-only changes

**File:** `.github/workflows/ci.yml`

Add a pre-check before the coverage step (around line 40) to detect if source files changed:

```yaml
- name: Check if source files changed
  id: src-changed
  if: matrix.node-version == '20.x'
  run: |
    # Compare against merge base to detect changes in this PR/push
    git fetch origin ${{ github.base_ref || 'master' }} --depth=1 || true
    BASE=$(git merge-base HEAD origin/${{ github.base_ref || 'master' }} 2>/dev/null || echo "HEAD^")

    if git diff --name-only $BASE...HEAD | grep -q '^src/'; then
      echo "changed=true" >> $GITHUB_OUTPUT
    else
      echo "changed=false" >> $GITHUB_OUTPUT
    fi

- name: Run unit tests with coverage
  if: matrix.node-version == '20.x' && steps.src-changed.outputs.changed == 'true'
  run: npm test -- --run --coverage
```

**Fallback behavior:** If git commands fail (e.g., first push to new branch), the grep will return false and skip coverage. This is safe because the next push will catch it. Alternative: default to true (always run) if merge-base fails.

**Why this approach:**
- Avoids blocking doc/chore PRs that don't touch src/
- Still runs full test suite (no `--coverage` flag = no threshold checks)
- Simpler than path filters in workflow triggers (which would skip entire test job)

### 3. Update CLAUDE.md testing standards

**File:** `CLAUDE.md`

Add new section after "Code Health Rules":

```markdown
## Testing Standards

**Coverage is enforced.** Thresholds are defined in `vitest.config.ts` and checked in CI. PRs that drop coverage will fail.

**Test before implement:** For new features, write tests first or immediately after implementation — not as an afterthought.

**Test structure:**
- Unit tests: `tests/<category>/` matching src structure
- Integration tests: `tests/integration/` for multi-component flows
- Follow existing patterns (see `tests/tools/cache.test.ts`): describe/beforeEach/it blocks

**What to test:**
- ✅ Happy paths + error cases + edge cases
- ✅ Retry logic, timeout handling, failure modes
- ✅ Boundary inputs (empty, null, max values)
- ✅ External dependency mocking (adb, gradle, file system)
- ❌ NOT just smoke tests — comprehensive behavioral coverage required

**When coverage fails:** Run `npm run test:coverage` locally to check current thresholds and fix before PR.
```

**Placement rationale:** After "Code Health Rules" so it's grouped with other quality gates (complexity checks, beads enforcement).

### 4. Update DECISIONS.md with ADR

**File:** `DECISIONS.md`

Add new ADR entry documenting this decision:

```markdown
## Test Coverage Enforcement (2026-02-08)

**Decision:** Enforce code coverage thresholds via Vitest and block PRs that drop coverage below baseline.

**Context:**
- Insights analysis identified "shallow testing" as #1 friction source
- Claude repeatedly wrote only happy-path smoke tests, requiring correction cycles
- Coverage was collected but not enforced (68.71% baseline with no gates)
- Tools had very low coverage (41.6%) while services were well-tested (95.21%)

**Thresholds chosen:**
- Lines: 68% (current: 68.71%)
- Branches: 60% (current: 60.49%)
- Functions: 63% (current: 63.17%)
- Statements: 70% (current: 70.1%)

**Rationale:** Lock at current baseline to prevent regression. These will be incrementally raised as low-coverage modules (tools/adapters) improve from 6-30% to 90%+ target.

**Implementation:**
- vitest.config.ts with thresholds
- CI skips coverage for doc-only changes (git diff check on src/)
- CLAUDE.md updated with testing standards

**Migration strategy:**
- Design doc first: testing strategy for tools with external dependencies
- 8 improvement tasks targeting 90%+ coverage
- Incremental threshold increases: 68→70→75→90 as modules improve

**Alternatives considered:**
- Naive pre-commit hook checking for test file changes (rejected: blocks docs/chore commits)
- Codecov blocking PRs (rejected: external service dependency, prefer local enforcement)
- Per-file thresholds (deferred: global thresholds sufficient initially, add later if needed)

**Success criteria:**
- Coverage drops = CI fails
- Doc-only PRs skip coverage gracefully
- Tools reach 90%+ coverage within 2-3 sprints
```

## Critical Files

- **NEW** `vitest.config.ts` — Coverage thresholds configuration
- **NEW** `docs/plans/2026-02-08-test-coverage-enforcement.md` — Persist this plan for future reference
- **MODIFY** `.github/workflows/ci.yml` — Add src/ change detection, make coverage conditional
- **MODIFY** `CLAUDE.md` — Add testing standards section
- **MODIFY** `DECISIONS.md` — Add ADR entry documenting coverage enforcement decision
- **REFERENCE** `tests/tools/cache.test.ts` — Example test pattern to follow

## Verification

**Local testing:**
```bash
# Check that current code passes thresholds
npm run test:coverage

# Output should show:
# All files          | 68.71 | 60.49 | 63.17 | 70.1
# Thresholds         | 68    | 60    | 63    | 70
# ✓ Coverage thresholds met
```

**CI testing:**
1. Create PR with source changes — coverage should run and pass
2. Create PR with only README changes — coverage step should skip
3. Drop coverage below threshold in a test PR — CI should fail with clear message

**Expected behavior after implementation:**
- Coverage runs automatically on Node 20.x when src/ files change
- Vitest fails with exit code 1 if below threshold
- GitHub Actions marks job as failed (red X)
- Doc/chore PRs skip coverage check (still run tests)
- Codecov upload continues as informational tool

## Migration Path

**Phase 1 (this PR):** Lock baseline at current coverage levels to prevent regression

**Phase 2 (next sprint):** Improve low-coverage areas identified in exploration

**Low-coverage modules (under 35%):**
- adb-device.ts (6.66%)
- adb-app.ts (7.69%)
- adb-logcat.ts (8.69%)
- emulator-device.ts (5.45%)
- gradle-list.ts (11.11%)
- gradle-get-details.ts (26.31%)
- ui.ts (30.15%)
- emulator.ts adapter (14.28%)

**Beads issues to create (after implementation parent issue is created):**

**IMPORTANT:** The improvement epic depends on the implementation parent issue. Set dependency after creating both.

1. **Epic:** "Improve test coverage to 90%+"
   - Priority: P1
   - Description: Systematic improvement of test coverage for tools and adapters, targeting 90%+ to match services/utils quality bar

2. **Blocker issue (must complete before testing tasks):**
   ```bash
   bd create --parent=<epic-id> \
     --title="Design test coverage improvement strategy" \
     --type=task \
     --priority=1 \
     --description="[Needs: design]

   Create comprehensive design doc for testing tools/adapters with external dependencies.

   **Scope:**
   - How to test tools that call adb, gradle, emulator (mocking strategy)
   - What to test vs what to exclude (e.g., real device requirements)
   - Testing patterns for integration-heavy code
   - Mock patterns and reusable test utilities
   - Estimated effort per tool (6% → 90% is non-trivial)

   **Output:** docs/plans/YYYY-MM-DD-test-coverage-strategy.md

   **Modules to cover:**
   - adb-device.ts (6.66%), adb-app.ts (7.69%), adb-logcat.ts (8.69%)
   - emulator-device.ts (5.45%), emulator.ts adapter (14.28%)
   - gradle-list.ts (11.11%), gradle-get-details.ts (26.31%)
   - ui.ts (30.15%)
   "
   ```

3. **Tool/adapter improvement tasks (all depend on design doc issue):**
   - `bd create --parent=<epic-id> --title="Add tests for adb-device tool (6.66% → 90%+)" --type=task --priority=2`
   - `bd create --parent=<epic-id> --title="Add tests for adb-app tool (7.69% → 90%+)" --type=task --priority=2`
   - `bd create --parent=<epic-id> --title="Add tests for adb-logcat tool (8.69% → 90%+)" --type=task --priority=2`
   - `bd create --parent=<epic-id> --title="Add tests for emulator-device tool (5.45% → 90%+)" --type=task --priority=2`
   - `bd create --parent=<epic-id> --title="Add tests for gradle-list tool (11.11% → 90%+)" --type=task --priority=2`
   - `bd create --parent=<epic-id> --title="Add tests for gradle-get-details tool (26.31% → 90%+)" --type=task --priority=2`
   - `bd create --parent=<epic-id> --title="Add tests for ui tool (30.15% → 90%+)" --type=task --priority=2`
   - `bd create --parent=<epic-id> --title="Add tests for emulator adapter (14.28% → 90%+)" --type=task --priority=2`

   **After creating tasks:**
   1. Add dependency so epic depends on implementation parent:
   ```bash
   bd dep add <epic-id> <implementation-parent-id>
   ```

   2. Add dependencies so all 8 tool/adapter tasks depend on the design doc issue:
   ```bash
   bd dep add <adb-device-task-id> <design-doc-issue-id>
   bd dep add <adb-app-task-id> <design-doc-issue-id>
   # ... repeat for all 8 tasks
   ```

**Phase 3 (incremental):** Raise thresholds as low-coverage modules improve
- After design doc complete and first 2-3 tools reach 90%: bump lines to 70%, branches to 62%
- After all 8 tools/adapters reach 90%: bump to 75/65/70/75 (approaching services quality bar)
- Long-term goal: 90%+ across the board (match services at 95%)
- Track each threshold bump in DECISIONS.md with rationale and coverage snapshot

**Optional future enhancement:** Per-directory thresholds in vitest.config.ts:
```typescript
thresholds: {
  lines: 60,
  'src/services/': { lines: 90 },    // Stricter for well-tested code
  'src/tools/': { lines: 40 },        // More lenient during migration
}
```
