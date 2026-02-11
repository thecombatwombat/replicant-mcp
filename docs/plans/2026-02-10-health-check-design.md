# Health-Check Command Design

**Issue:** `replicant-mcp-4qd`
**Branch:** `feature/health-check`
**Wave:** 2

## Decision: CLI Subcommand Only

Add `replicant doctor` as a CLI subcommand. Not an MCP tool — MCP clients can shell out to the CLI if needed. This avoids adding complexity to the MCP server for a diagnostic-only feature.

## Pattern

Follow existing CLI command pattern in `src/cli/cache.ts`:
- Export `createDoctorCommand(): Command` from `src/cli/doctor.ts`
- Register in `src/cli.ts` via `program.addCommand(createDoctorCommand())`
- Add export to `src/cli/index.ts`

## Checks

Reimplement `scripts/check-prerequisites.sh` (154 lines of bash) in TypeScript:

| # | Check | Pass | Warn | Fail |
|---|-------|------|------|------|
| 1 | Node.js >= 18 | Version ≥ 18 | — | Not installed or < 18 |
| 2 | npm installed | Found in PATH | — | Not found |
| 3 | ANDROID_HOME set | Env var set and dir exists | Env var set but dir missing | Not set |
| 4 | adb in PATH | Found + version | — | Not found |
| 5 | emulator in PATH | Found | — | Not found |
| 6 | avdmanager in PATH | Found | — | Not found |
| 7 | Available AVDs | ≥ 1 AVD listed | 0 AVDs | avdmanager unavailable |
| 8 | Connected devices | ≥ 1 device | 0 devices | adb unavailable |
| 9 | System gradle | Found + version | Not installed (optional) | — |

Each check returns:
```typescript
interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;      // e.g., "v22.1.0" or "not found"
  suggestion?: string;  // e.g., "Install via Android Studio SDK Manager"
}
```

## Output Format

Detect terminal vs pipe with `process.stdout.isTTY`:

**TTY (interactive):** Colored text matching check-prerequisites.sh style:
```
Checking replicant-mcp prerequisites...
========================================
Node.js (>=18): OK (v22.1.0)
adb: OK (Android Debug Bridge version 35.0.2)
...
========================================
PASSED: All prerequisites met!
```

**Pipe (JSON):** Structured output for automation:
```json
{
  "status": "pass",
  "checks": [...CheckResult],
  "summary": { "ok": 7, "warn": 1, "fail": 0 }
}
```

Exit code: 0 if all pass/warn, 1 if any fail.

## Files

| File | Action |
|------|--------|
| `src/cli/doctor.ts` | Create |
| `src/cli.ts` | Add `createDoctorCommand()` import + registration |
| `src/cli/index.ts` | Add export |

## Tests

`tests/cli/doctor.test.ts`:
- Mock `execSync` / `which` for each check
- Test all-pass scenario
- Test failure scenario (missing adb)
- Test warning scenario (no AVDs)
- Test JSON output mode
- Test exit code behavior

## Pre-PR

- `npm run test:coverage` — all 4 thresholds must pass
- `npm run check-complexity`

## Note on `src/cli.ts` Conflict

Agent 3 (Wave 1, `fix/version-mismatch`) also edits `src/cli.ts`. Since Wave 2 branches from master AFTER Wave 1 merges, this agent will see Agent 3's changes. No conflict.
