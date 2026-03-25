# Codebase Concerns

**Analysis Date:** 2026-03-25

## Test Coverage Gaps

**Tool modules have systematically low coverage:**
- Tools directory: 43% overall coverage with high variance (6-95%)
- `src/tools/gradle-test.ts`: 6.45% - critical gap (5 of 31 lines)
- `src/tools/gradle-list.ts`: 13.33% - critical gap (2 of 15 lines)
- `src/tools/gradle-get-details.ts`: 27.77% - major gap (5 of 18 lines)
- `src/tools/adb-device.ts`: 27.27% - major gap (12 of 44 lines)
- `src/tools/adb-app.ts`: 43.58% - moderate gap (17 of 39 lines)
- `src/tools/ui.ts`: 45% - moderate gap (27 of 60 lines, though this file is partially deprecated)

**Adapter coverage also weak:**
- `src/adapters/adb.ts`: 48.78% - gap (20 of 41 lines)
- `src/adapters/emulator.ts`: 15% - critical gap (3 of 20 lines, 13 of 15 functions untested)

**Impact:** Tools handle external process execution and device communication. Low coverage means integration bugs and error cases go undetected before shipping. Gradle and adb failures may not be caught by CI.

**Fix approach:**
1. Unit test gradle/adb tool handlers with mocked process output (deterministic)
2. Add integration tests for error paths: device offline, build failures, missing binaries
3. Create fixtures for gradle output parsing edge cases (malformed JSON, missing fields)
4. Prioritize emulator adapter (only 15% tested but has complex state transitions)

---

## Fragile Areas — Unsafe Patterns

**Server tool dispatch:**
- Location: `src/server.ts` line 166
- Issue: `throw new Error("Unknown tool: ${name}")` with no guard — if a tool is registered but handler is missing, runtime error instead of caught exception
- Impact: MCP protocol violation; client gets crash instead of proper error response
- Safe modification: Use toolDefinitions map to validate handler exists before registration; change to ReplicantError with clear error code

**OCR Worker lifecycle:**
- Location: `src/services/ocr.ts` lines 6-25
- Issue: Worker is created lazily on first use, never explicitly initialized, may fail if Tesseract.js binaries are missing. `getWorker()` catches creation errors silently (no visible state), `terminateOcr()` assumes worker exists
- Impact: Silent failures; first OCR call may hang or fail without clear error. Cleanup only called explicitly (not guaranteed)
- Risk: In concurrent UI find operations, multiple getWorker() calls could create multiple workers

**Grid overlay image handling:**
- Location: `src/services/grid.ts` lines 144-149
- Issue: Async sharp pipeline composition with multiple `await` calls; if intermediate image operations fail, temp image data may leak memory
- Impact: Long-running sessions with many grid operations could accumulate orphaned image buffers
- Safe modification: Wrap pipeline in try-finally; validate image metadata before composition

**Device state mutation:**
- Location: `src/services/device-state.ts` line 5, but controlled via proper methods
- Good: Private `currentDevice` with only public accessors `selectDevice()`, `ensureDevice()`, `getSelected()` — no module-level mutation risk

---

## Known Bugs and Edge Cases

**XML parsing may fail silently on malformed UI dumps:**
- Location: `src/parsers/ui-dump.ts` lines 60-100
- Issue: Manual recursive descent parser with manual depth tracking. If XML structure is unexpected (e.g., unclosed tags, nested nodes without proper closing), the parser returns incomplete tree. No schema validation.
- Symptom: UI hierarchy truncated; AI can't see bottom of screen
- Files: `src/parsers/ui-dump.ts`, tests at `tests/parsers/ui-dump.test.ts`
- Trigger: Non-standard ROMs or buggy UI dump implementations that emit malformed XML
- Workaround: None — fallback to screenshot/OCR if element not found
- Test coverage: 94.73% but branch coverage only 75% (edge cases not all tested)

**File path handling across platforms fragile:**
- Location: `src/services/environment.ts` lines 118-230
- Issue: Path joining uses `path.join()` but SDK detection mixes forward/backward slashes on Windows. `.bat` vs `.exe` detection helps but not bulletproof
- Symptom: "adb not found" on some Windows setups with Android SDK installed
- Trigger: Custom Windows PATH entries with mixed separators; non-standard SDK install locations
- Mitigation in place: Cross-platform detection (Windows/Darwin/Linux specific paths) but test coverage only 91.11% (9 of 90 lines missed)

**Screenshot scaling state not atomic:**
- Location: `src/adapters/ui-automator.ts` lines 59, 72-88
- Issue: `scalingState` is private instance variable but updated on every screenshot. If two concurrent UI operations happen (unlikely in single-device model but theoretically possible), scaling coordinates could be misaligned
- Impact: Grid cell coordinates may be off if scaling state changes between screenshot and grid operation
- Mitigation: Single-device model makes this rare, but state isn't locked
- Safe modification: Add request-scoped scaling state or document single-concurrency guarantee

**Cache TTL cleanup incomplete:**
- Location: `src/services/cache-manager.ts` lines 42
- Issue: Cache has TTL mechanism but cleanup only happens on access (lazy delete). If cache is queried infrequently, stale entries pile up indefinitely
- Impact: Memory usage grows unbounded in long-running sessions with many cache puts
- Test coverage: 100% (happy path tested, but TTL expiry not explicitly tested)

---

## Performance Bottlenecks

**OCR is synchronous serialization:**
- Location: `src/services/ocr.ts` line 13-47
- Issue: Single worker instance; multiple calls to `extractText()` are serialized through one Tesseract.js instance. Each recognition can take 500ms-2s depending on image complexity
- Impact: If user finds element, gets OCR results (1.5s), then finds another element with OCR, second call is blocked. With grid cell refinement (multiple crops), this multiplies.
- Current workaround: None built-in; relies on UI find strategy (accessibility → OCR → visual as fallback, not preferred)
- Improvement path: Spawn worker pool (3-5 workers) or document expected latency in tool descriptions

**Tesseract.js worker not preinitialized:**
- Location: `src/services/ocr.ts` line 6-10
- Issue: Worker created on first `extractText()` call, not on server startup. First OCR operation adds 500ms+ initialization cost
- Impact: Poor latency perception for first OCR-based find in a session
- Fix approach: Preload worker in ServerContext creation (async initialization in startup)

**Screenshot scaling compresses twice:**
- Location: `src/adapters/ui-automator.ts` lines 200-254
- Issue: Screenshot is downscaled via sharp (1 pass), then when inlined as base64 or JPEG'd, data URI encoding adds ~33% overhead
- Impact: ~300KB inline screenshot per tool response; over 50-turn session, ~15MB of token space for image payloads
- Current mitigation: WebP at 80% quality + 1000px max dimension (documented in DECISIONS.md [2026-01-26])
- Improvement path: Could strip EXIF or pre-encode to binary; acceptable as-is given current optimization

---

## Scaling Limits

**Single device model:**
- Current capacity: 1 device at a time (enforced by DeviceStateManager)
- Limit: If user has multiple devices connected, only one is usable
- Scaling path: DECISIONS.md [2025-01-20] explicitly chose single-device for simplicity. Multi-device would require adding optional `deviceId` parameter to all tools or reconnecting selection system. Would likely become new concern once attempted.

**Environment detection caching:**
- Location: `src/services/environment.ts` line 16
- Issue: Cached forever once detected. If user connects a device mid-session or SDK path changes (unlikely but possible in development), detection doesn't refresh
- Mitigation: Cache refresh only on explicit `adb-device select` or full server restart
- Improvement path: Add cache invalidation API or time-based refresh (e.g., 5-minute TTL on environment detection)

**Process timeout fixed at 30s-600s:**
- Location: `src/services/process-runner.ts` lines 41-42
- Issue: Hard limits: default 30s, max 600s. Long gradle builds, emulator waits, or slow device responsiveness hits these limits
- Trigger: `gradle build` on large projects, emulator startup on slow hardware
- Mitigation: Configurable via `options.timeoutMs` parameter, but MCP tools don't expose this (would require API change)
- Improvement path: Expose timeout as optional parameter on time-sensitive tools (gradle-build, emulator-device); increase defaults based on operation (emulator startup → 120s)

---

## Dependencies at Risk

**Tesseract.js (7.0.0):**
- Risk: Heavy dependency (50+ MB after installation); WASM binaries for multiple architectures. If core tessdata breaks, no fallback OCR
- Impact: Large npm package, slow installation; no offline OCR fallback if WASM fails
- Mitigation: Optional — server works without OCR (falls back to screenshot + LLM vision)
- Migration plan: Could swap for `node-tesseract-ocr` (lighter) or remove entirely if OCR contribution is deemed negligible

**Sharp (0.34.5):**
- Risk: Native C++ dependency (libvips binding); may break on OS updates; architecture-specific (arm64, x86_64)
- Impact: Installation failures on uncommon architectures (M1 Mac, unusual Linux distros)
- Mitigation: Fallback to no screenshot scaling if sharp fails (would require API change)
- Current status: Well-maintained; unlikely to break soon

**Execa (9.6.1):**
- Risk: Process spawning library; updates could change stdout/stderr handling or timeout behavior
- Impact: Tool output parsing might break if execa changes (unlikely but version matters for reliability)
- Mitigation: Pinned version in package.json
- Monitoring: Execa is stable; breaking changes are rare

---

## Untested Error Paths

**Gradle output parsing:**
- Files: `src/parsers/gradle-output.ts` (60.86% coverage)
- What's not tested: Malformed JSON from gradle output, missing expected fields (e.g., no test results), gradle crash messages mixed with JSON
- Risk: If gradle behavior changes or output format is unexpected, parser may silently skip data or throw unhandled exception
- Fix: Add tests for malformed output fixtures (invalid JSON, truncated output, gradle errors)

**ADB logcat filtering:**
- Files: `src/tools/adb-logcat.ts` (70% coverage, only 1 of 4 functions tested)
- What's not tested: Filter syntax edge cases, package name filtering with special characters, simultaneous logcat reads
- Risk: Filtering doesn't work as expected; user sees unfiltered noise
- Fix: Add tests for filter parsing and package name matching with edge cases

**Device selection and state transitions:**
- Files: `src/services/device-state.ts` has 100% coverage, but `src/tools/adb-device.ts` only 27.27% coverage
- What's not tested: Device offline during operation, device disconnected between operations, rapid device selection changes
- Risk: Race conditions; unclear error messages if device goes offline mid-operation
- Fix: Add integration tests that simulate device offline scenarios

**Process runner command validation:**
- Files: `src/services/process-runner.ts` (96.29% coverage, very good)
- What's tested: Happy path, timeout, ExecaError handling
- What's not tested: Edge cases in `validateCommand()` and `validateShellPayload()` (command injection attempts, unusual but valid flag combinations)
- Risk: Security boundary; low risk but should verify all unsafe patterns are caught
- Fix: Add explicit security tests for shell metacharacters and command chaining attempts

---

## Security Considerations

**Shell command validation present but manual:**
- Location: `src/services/process-runner.ts` lines 116-195
- Approach: Blocklist of dangerous characters (`$`, `;`, `|`, `&`, backticks, etc.) and command wrappers (`sh -c`, `bash -c`)
- Threat: Command injection if user input flows directly to shell without sanitization
- Mitigation: Validation is thorough; uses blocklist approach which is reasonably safe for adb/gradle use
- Recommendation: Add explicit allow-list for expected adb commands (pull, push, shell, install, etc.) as defense-in-depth; current blocklist is good enough

**File path traversal not explicitly tested:**
- Location: `src/adapters/adb.ts` lines 67-76 (pull operation), `src/cli/` operations
- Issue: `adb pull <remotePath> <localPath>` accepts user paths. Malicious path like `../../etc/passwd` could pull arbitrary files
- Mitigation: adb itself applies restrictions; remote filesystem is device-confined
- Risk level: Low (adb device permissions are the boundary), but worth documenting

**Environment variable clobbering:**
- Location: `src/services/environment.ts` uses `process.env.ANDROID_HOME`
- Issue: If user has malicious shell profile that exports `ANDROID_HOME=/malicious/path`, tool would use it
- Mitigation: Environment detection validates SDK path (checks for expected structure)
- Risk level: Low (environmental, not code-based)

---

## Technical Debt — Code Patterns to Refactor

**UI tool split created edge case in ui.ts:**
- Location: `src/tools/ui.ts` (45% coverage, deprecated)
- Issue: After split into `ui-query`, `ui-action`, `ui-capture` ([2026-03-10] DECISIONS.md), the original `ui.ts` file remains but is no longer the primary handler. MCP clients may still reference it; ambiguity about which tool to use
- Impact: Code smell; dead code (though still registered). Slightly confusing for maintainers
- Fix approach: Remove `ui` tool entirely (no backward compat alias needed per DECISIONS.md), clean up imports in `src/server.ts`, document migration in release notes

**Type-level error context weakening:**
- Location: `src/tools/` handlers use generic error handling
- Pattern: Errors from adapters converted to ReplicantError, but context sometimes lost
- Example: If gradle parsing fails, which file caused it? Original error stack is available but not structured
- Impact: Debugging failures requires log context; could be improved with detailed error annotations
- Acceptable current state: ReplicantError has `context` object for structured data; used well in most places

**CLI and MCP initialization could fail ungracefully:**
- Location: `src/index.ts` lines 5-20
- Issue: `process.exit(1)` on errors is abrupt; no cleanup (OCR worker terminate, processes kill, etc.)
- Impact: Long-running sessions may leave orphaned processes if CLI exits unexpectedly
- Fix approach: Add graceful shutdown handler that runs `terminateOcr()` and any cleanup before exit

---

## Missing Critical Features

**No session/context persistence across invocations:**
- Problem: Each tool invocation is stateless except for cache. User can't reference "previous device screenshots" or "last build results" without asking LLM to track them
- Current workaround: Cache system with IDs (e.g., `gradle-list` returns `cacheId`, `gradle-get-details` retrieves it)
- Blocks: Complex multi-step workflows that depend on referencing prior state
- Priority: Medium (cache + LLM state tracking sufficient for MVP, but feature-gating improvements)

**No progress/status reporting for long operations:**
- Problem: Gradle build, emulator startup, or large OCR can take 30s+. MCP client gets no update until operation completes
- Current workaround: None; client just waits
- Blocks: LLM can't show progress to user or make decisions mid-operation
- Priority: Low (MCP protocol limitation; would require streaming support)

**No device capability probing:**
- Problem: Server assumes all devices support adb, emulator, gradle. Some devices (like remote emulators or specialized hardware) may not
- Blocks: Using replicant-mcp with non-standard Android environments
- Priority: Low (out of scope for MVP; can add feature flag later)

**No screenshot comparison/diffing:**
- Problem: User wants to compare two screenshots to see what changed. Currently, only raw screenshots available
- Blocks: Advanced debugging workflows
- Priority: Low (can be done client-side with image diffing tools)

---

## Code Complexity Violations

**No violations currently enforced.** The project has active guardrails:
- `scripts/check-complexity.sh` ensures files stay under 500 lines, functions under 80 lines
- Largest file: `src/adapters/ui-automator.ts` at 476 lines (within limit)
- Largest function: Not exceeding 80 lines (enforced in CI)

However:
- **Borderline files:** `src/cli/adb.ts` (282 lines), `src/cli/ui.ts` (243 lines) are large but excluded from limits (CLI command builders are exempt per CLAUDE.md)
- **Recommendation:** If CLI complexity becomes a blocker, consider splitting into subcommands or helper modules despite exemption

---

## Test Coverage Improvement Roadmap

**Current:** 73.29% line coverage, 72.52% statement coverage (target baseline: 68% lines, 67% statements)

**Priority 1 (Critical gaps):**
1. `gradle-test.ts` (6.45%) → Add basic happy path test
2. `emulator.ts` (15%) → Add startup/teardown happy path
3. `gradle-list.ts` (13.33%) → Add output parsing test
4. `adb-device.ts` (27.27%) → Add listing and selection tests

**Priority 2 (Major gaps):**
1. `adb-app.ts` (43.58%) → Add package operations (install/uninstall/launch)
2. `gradle-get-details.ts` (27.77%) → Add cache retrieval flow
3. `emulator-device.ts` (51.85%) → Add all device operations

**Priority 3 (Moderate):**
1. `ui.ts` (45%) → Consolidate or deprecate; coverage improvement depends on decision
2. `adb-logcat.ts` (70%) → Add filter combinations

**Target:** Raise tool coverage from 43% → 85% over next 3-4 phases, keep services/adapters at 90%+

---

*Concerns audit: 2026-03-25*
