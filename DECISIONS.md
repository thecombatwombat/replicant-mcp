# Decision Log

Architectural and design decisions for replicant-mcp.
Each entry captures **why** a choice was made, not just what.

Format: `## [date] Title` with Tags, Context, Decision, Alternatives, Refs.

---

## [2025-01-20] TypeScript + Node.js for MCP server implementation
Tags: architecture, language, mcp
Context: Needed to choose a language/runtime for building an Android MCP server. Python, Go, and TypeScript were candidates.
Decision: TypeScript + Node.js. The MCP SDK ecosystem is strongest in TypeScript, and we could port patterns directly from xc-mcp (the iOS equivalent).
Alternatives: Python (weaker MCP SDK support at the time), Go (no official MCP SDK), Kotlin (would be natural for Android but MCP SDK was JS-first).
Refs: docs/plans/2025-01-20-replicant-mcp-design.md

## [2025-01-20] Accessibility-first UI automation over screenshots
Tags: ui, automation, accessibility, architecture
Context: Two primary approaches for AI-driven UI interaction — screenshot-based (OCR/vision) or accessibility tree (structured data). Screenshot approach is intuitive but brittle, resolution-dependent, and token-expensive.
Decision: Use accessibility tree dumps as the primary UI interaction method. Screenshots serve as fallback only when accessibility data is insufficient.
Alternatives: Screenshot-only with OCR (slow, error-prone, high token cost), coordinate-based tapping (fragile across devices), hybrid equal-weight (complexity without clear benefit).
Refs: docs/plans/2025-01-20-replicant-mcp-design.md, CLAUDE.md

## [2025-01-20] Single device focus over multi-device orchestration
Tags: architecture, state-management, scope
Context: Could support multiple simultaneous devices or keep a single "active device" model. Multi-device adds state complexity and ambiguity in tool calls.
Decision: Single active device. `adb-device select` sets the target. Simpler state management, clearer error messages. Can add explicit `deviceId` parameter later if needed.
Alternatives: Multi-device with explicit IDs on every call (verbose, error-prone), auto-routing based on context (too magical).
Refs: docs/plans/2025-01-20-replicant-mcp-design.md

## [2025-01-20] Progressive disclosure via cache IDs
Tags: architecture, token-optimization, caching
Context: Raw CLI output from gradle, adb, and UI dumps can be 5K-30K+ tokens. Dumping everything into MCP responses exhausts context windows fast.
Decision: Every expensive operation returns a summary + cache ID. Full details available via `*-get-details` or `cache get`. Event-driven invalidation + TTL fallback.
Alternatives: Always return full output (context exhaustion), truncation (lossy, agent can't get details), streaming (MCP doesn't support well).
Refs: docs/plans/2025-01-20-replicant-mcp-design.md, PR#43

## [2025-01-20] npm as primary distribution channel
Tags: distribution, packaging, devex
Context: Needed users to install the MCP server without cloning the repo. npm is the natural choice for a Node.js tool, but git clone is simpler for contributors.
Decision: Publish to npm as `replicant-mcp`. Support both `npm install -g` and git clone workflows. Automated release via script.
Alternatives: Docker (heavy for a dev tool), Homebrew (macOS only), binary releases (build complexity).
Refs: docs/plans/2025-01-20-npm-publishing-design.md

## [2025-01-21] Visual fallback as a phased approach
Tags: ui, screenshots, architecture
Context: Accessibility tree doesn't cover all apps well (missing labels, custom views). Needed a fallback strategy. Could go all-in on server-side vision or delegate to the consuming LLM.
Decision: Phased approach. Phase 1: provide screenshot + metadata for LLM-side visual reasoning. Phase 2: server-side OCR. Phase 3: template matching. Keep server lightweight initially.
Alternatives: Server-side OCR from day one (heavy dependency, Tesseract is slow), no fallback (broken for poorly-labeled apps).
Refs: docs/plans/2025-01-21-visual-fallback-design.md, PR#22

## [2025-01-21] Just Works UX — auto-detect everything
Tags: devex, environment, onboarding
Context: Users hit cryptic errors: "adb not found", "no device selected" even with one device connected. Every friction point required manual workaround.
Decision: Auto-detect Android SDK (probe ANDROID_HOME, common paths, PATH), auto-select single device, actionable error messages that tell you exactly how to fix the problem.
Alternatives: Require explicit config file (friction), document all setup steps (still friction), fail fast with generic errors (current bad state).
Refs: docs/plans/2026-01-21-just-works-ux-design.md, PR#11

## [2025-01-21] OIDC Trusted Publisher for npm releases
Tags: ci, security, npm, distribution
Context: Needed automated npm publishing from GitHub Actions. Traditional approach uses NPM_TOKEN secret. OIDC Trusted Publisher is more secure (no long-lived tokens).
Decision: Use npm OIDC Trusted Publisher via GitHub Actions. No NPM_TOKEN needed — GitHub proves identity to npm via OIDC.
Alternatives: NPM_TOKEN secret (less secure, token rotation burden), manual publishing (doesn't scale).
Refs: PR#12, PR#13, PR#14, PR#16, PR#17

## [2025-01-21] PR workflow with Greptile automated review
Tags: workflow, code-review, ci
Context: Solo developer + AI agents working on codebase. Need code review but no human team. Greptile provides AI code review on PRs.
Decision: All changes go through PRs (no direct pushes to master). Greptile reviews automatically. Address Greptile feedback, then wait for human approval before merge. Never merge-then-monitor.
Alternatives: Direct push to master (no review gate), human-only review (bottleneck), fully automated merge on CI pass (no quality gate).
Refs: docs/plans/2025-01-21-pr-automation-agent-design.md, PR#8, CLAUDE.md

## [2026-01-22] Screenshot scaling to 1000px max dimension
Tags: screenshots, token-optimization, performance
Context: Raw device screenshots are 1080x2400+ pixels. As base64 in MCP responses, they're massive. LLMs don't need full resolution for UI understanding.
Decision: Scale screenshots to 1000px max dimension, use JPEG compression (later upgraded to WebP). Reduces token cost ~80% with minimal information loss for LLM consumption.
Alternatives: Full resolution (context exhaustion), aggressive downscaling to 500px (loses detail for small text), no inline screenshots (requires file path coordination).
Refs: docs/plans/2026-01-22-screenshot-scaling-design.md, PR#27, PR#29

## [2026-01-26] WebP over JPEG/PNG for screenshot compression
Tags: screenshots, performance, image-format
Context: Screenshots were large even after JPEG compression. Needed better compression without losing the sharpening that helps LLM readability.
Decision: WebP at 80% quality with sharpening. ~200KB output vs ~400KB JPEG for equivalent visual quality. Transparency support if needed later.
Alternatives: JPEG (no transparency, larger), PNG+pngquant (still large), AVIF (poor tooling support in sharp/Node.js).
Refs: PR#49

## [2026-01-26] Context exhaustion fixes — don't dump data, give control
Tags: architecture, token-optimization
Context: Three tools were burning through context: ui find grid image (151K chars), adb-device properties (28K chars), adb-app list (11K chars). ~190K chars in a short session.
Decision: Apply progressive disclosure consistently. Grid images get JPEG compression + downscaling. Device properties return 8-field summary + cache ID (28K → 500 chars). App list gets pagination + filtering (default limit 20).
Alternatives: Increase context limits (not in our control), warn users about large responses (doesn't fix the problem), remove features (loses capability).
Refs: docs/plans/2026-01-26-context-exhaustion-fixes-design.md, PR#43

## [2026-01-26] Windows SDK and PATH discovery support
Tags: platform, windows, devex
Context: Server assumed Unix conventions (forward slashes, `which` command, no `.exe` extensions). Windows users couldn't use the tool.
Decision: Add platform-aware SDK discovery (Windows-specific paths, `.exe`/`.bat` extensions, `where` instead of `which`), cross-platform test suite with Windows CI runner.
Alternatives: Unix-only with documentation (excludes Windows users), WSL requirement (extra friction), separate Windows build (maintenance burden).
Refs: docs/plans/2026-01-26-windows-support-design.md, PR#48

## [2026-01-26] Sandbox-safe screenshot paths for Claude Desktop
Tags: screenshots, claude-desktop, security
Context: Claude Desktop runs MCP servers in a sandbox. Absolute file paths from `adb pull` aren't accessible to the sandbox. Screenshots need to be returned inline or to sandbox-accessible paths.
Decision: Default to inline base64 screenshots in MCP image content blocks. File-based screenshots use project-relative paths (accessible within sandbox).
Alternatives: Always file-based (broken in sandbox), temp directory (not accessible), require user to configure path (friction).
Refs: docs/plans/2026-01-26-sandbox-screenshot-path-design.md, PR#41, PR#47

## [2026-02-06] Version-pin dev tools via .tool-versions
Tags: tooling, remote-env, versioning
Context: bd and gh CLI versions were hardcoded in install-dev-tools.sh. Local and remote environments would drift when versions were updated in one place but not the other.
Decision: Single source of truth in `.tool-versions` file. Install script reads from it. Bump one file, both environments stay in sync.
Alternatives: Hardcode in script (drift), use package.json config (non-standard for non-npm tools), asdf/mise (extra tool dependency).
Refs: PR#55

## [2026-02-06] /check-env for automated environment health checks
Tags: tooling, devex, automation
Context: bd doctor had 8 warnings, tool versions drifted, worktrees accumulated. No single command to check everything, no automatic detection.
Decision: `scripts/check-env.sh` checks tool versions, git state, beads health, plugin sync, build status. `--quick` mode runs on SessionStart hook. `/check-env` slash command runs full check with Claude acting on results.
Alternatives: Manual bd doctor + git status (forgettable), CI-only checks (doesn't help local/remote dev), single monolithic health script without quick mode (too slow for session start).
Refs: PR#55

## [2026-02-06] Bulletproof beads sync across all agents and environments
Tags: tooling, beads, automation, multi-agent
Context: With multiple agents (local, remote, simultaneous), beads data goes stale fast. `bd sync` only exports locally without committing/pushing. The daemon was running with `Sync: none`. New sessions didn't pull latest state. Two agents could claim the same issue.
Decision: Three-layer sync strategy: (1) SessionStart pulls latest via `bd sync --full`, (2) daemon runs with `--auto-commit --auto-push --auto-pull --interval 30s` for continuous sync during sessions, (3) SessionEnd does final `bd sync --full` push. SessionStart also ensures daemon is running with correct flags.
Alternatives: Hook-based only (stale during long sessions), daemon-only (misses session boundaries), manual sync (forgettable and error-prone).
Refs: .claude/settings.json

## [2026-02-06] Harden beads sync for 30-50 agent scale
Tags: tooling, beads, multi-agent, reliability
Context: Initial three-layer sync strategy worked but had implementation gaps for true multi-agent scale: jitter window too small (0-5s with 50 agents = ~10 agents/second still colliding), SessionEnd had no retry on lock contention, and daemon health wasn't monitored.
Decision: (1) Widen SessionStart jitter from 0-5s to 0-30s (matches daemon's 30s interval — data is at most 30s stale anyway). (2) Add retry-once to SessionEnd sync (same pattern as SessionStart). (3) Add daemon health check to `check-env.sh` full mode. Key insight: the daemon is the correctness mechanism; session hooks are best-effort optimizations that reduce staleness at boundaries. Don't over-invest in hook complexity.
Alternatives: PID-based lock detection (lock is bd's responsibility, not ours), daemon log monitoring (upstream concern), one-daemon-per-machine architecture (bd daemon start is already idempotent), verbose hook logging (hook output already shows in session messages).
Refs: scripts/beads-sync-start.sh, scripts/beads-sync-end.sh, scripts/check-env.sh

## [2026-02-06] Remove publish and GitHub Release from release.sh (let CI own it)
Tags: workflow, ci, release, npm
Context: Both `scripts/release.sh` and `.github/workflows/release.yml` published to npm and created GitHub Releases. The local script published first, then CI failed trying to publish the same version. Every release since v1.3.1 had a failed CI run.
Decision: Remove npm publish and `gh release create` from `release.sh`. The script now stops after pushing the tag. CI already handles both with better security (OIDC trusted publisher + provenance attestation). Single responsibility: script preps and pushes, CI publishes.
Alternatives: Remove CI publish (loses OIDC/provenance benefits), add `--skip-publish` flag to script (complexity for no benefit since CI always runs), have CI detect already-published versions and skip (masks the real problem).
Refs: scripts/release.sh, .github/workflows/release.yml, CLAUDE.md

## [2026-02-06] Code health guardrails and UI tool decomposition
Tags: architecture, code-quality, tooling, refactoring
Context: `handleUiTool` was a 345-line function with an 8-operation switch — the hardest file to modify safely. `lastFindResults` was module-level mutable state. `ErrorContext` had `[key: string]: unknown` defeating TypeScript checks. Backward-compat aliases `FindWithOcrResult` and `findWithOcrFallback` were dead weight.
Decision: (1) Extract find operation to `src/tools/ui-find.ts`, decompose remaining operations into named handler functions dispatched via a map. (2) Move `lastFindResults` to `ServerContext` so it's scoped per server instance. (3) Remove `ErrorContext` index signature, add explicit `buildResult` field. (4) Delete backward-compat aliases and update tests. (5) Type execa errors with `ExecaError` instead of manual duck-typing. (6) Add `scripts/check-complexity.sh` as single source of truth for file/function length, unsafe casts, and index signatures — wired into CI, PreToolUse hook, and `/create-pr` skill.
Alternatives: Keeping backward-compat aliases (no consumers left, just dead code), putting all UI operations in separate files (over-splitting — only `find` is large enough to warrant its own file), ESLint max-lines rule (heavier toolchain, check-complexity.sh is simpler and catches more).
Refs: src/tools/ui.ts, src/tools/ui-find.ts, scripts/check-complexity.sh, .claude/commands/create-pr.md

## [2026-02-06] Plan persistence, beads enforcement, and ADR enforcement in PR workflow
Tags: workflow, enforcement, beads, decisions
Context: PR #60 introduced plan persistence and beads task graph granularity, but the beads check in pre-pr-gate.sh was warn-only (agents ignored it) and nothing enforced recording architectural/workflow decisions in DECISIONS.md. Plans and decisions were getting lost.
Decision: (1) Make beads check blocking (`exit 2`) in pre-pr-gate.sh with `trivial/` branch prefix as explicit opt-out for typos and minor doc fixes. (2) Add ADR check step to `/create-pr` skill — the agent reviews the diff for significant decisions and adds DECISIONS.md entries if missing. A shell script can't judge significance, but the agent prompt can. (3) Broaden DECISIONS.md scope to cover workflow decisions (process changes, enforcement mechanisms, convention changes), not just architectural ones.
Alternatives: Keep beads warn-only (agents ignore it), add a separate `--skip-beads` flag (harder to discover than branch prefix convention), automated DECISIONS.md detection via keywords (too many false positives/negatives), require DECISIONS.md entry on every PR (noise for trivial changes).
Refs: scripts/pre-pr-gate.sh, .claude/commands/create-pr.md, CLAUDE.md, PR#60

## [2026-02-08] Test Coverage Enforcement
Tags: testing, quality, ci, enforcement
Context: Insights analysis identified "shallow testing" as #1 friction source — Claude repeatedly wrote only happy-path smoke tests, requiring correction cycles. Coverage was collected but not enforced (68.71% baseline with no gates). Tools had very low coverage (41.6%) while services were well-tested (95.21%).
Decision: Enforce code coverage thresholds via Vitest and block PRs that drop coverage below baseline. Lock at current baseline (68% lines, 60% branches, 63% functions, 70% statements) to prevent regression. These will be incrementally raised as low-coverage modules (tools/adapters) improve from 6-30% to 90%+ target.
Implementation: (1) vitest.config.ts with thresholds, (2) CI skips coverage for doc-only changes (git diff check on src/), (3) CLAUDE.md updated with testing standards, (4) systematic improvement plan for 8 low-coverage modules, (5) emulator tests now run on all PRs (not just master) — expense justified for quality gate.
Alternatives: Naive pre-commit hook checking for test file changes (rejected: blocks docs/chore commits), Codecov blocking PRs (rejected: external service dependency, prefer local enforcement), per-file thresholds (deferred: global thresholds sufficient initially, add later if needed), keep emulator tests master-only (rejected: catch issues before merge, not after).
Refs: vitest.config.ts, .github/workflows/ci.yml, CLAUDE.md, docs/plans/2026-02-08-test-coverage-enforcement.md
