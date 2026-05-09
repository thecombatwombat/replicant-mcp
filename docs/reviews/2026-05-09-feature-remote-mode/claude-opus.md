# Code review — feature/remote-mode

**Reviewer:** Claude Opus 4.7 (1M) via `oh-my-claudecode:code-reviewer` agent
**Run date:** 2026-05-09
**Branch:** `feature/remote-mode` @ `5bdaa9f` (5 commits ahead of master `e349c3a`)
**Authoring plan:** `~/.claude/plans/add-a-remote-mode-binary-fog.md`
**Verdict:** REQUEST CHANGES

> **How to use this file in a fresh session:** start with the Triage table below.
> Pick a finding, jump to its full write-up (heading IDs preserved). Apply, run
> `npx vitest --run`, commit with the conventional prefix, move on.

---

## Triage — items I'd actually fix in this PR

### Block-on-merge

| ID | Status | File | Line(s) | One-line action |
|---|---|---|---|---|
| C1 | ✅ `fa6534e` | `src/cli/serve.ts` | 121, 157 | Route banner to **stderr**, not stdout. Drop the `log`/`errLog` split. Update `tests/cli/serve.test.ts` assertions accordingly. |
| C2 | ✅ `29a13b1` | `src/cli/serve.ts` | 123-130 | Wire `child.on(exit/error)` **before** signal handlers. Add SIGKILL escalation on second signal. Use `process.once`, remove listeners on child exit. Add a `shuttingDown` flag instead of `child.killed`. |
| H1 | ✅ `406a118` | `src/adapters/adb.ts` | 127-145 | Carry `-s <deviceId>` into the retry's `wait-for-device` call. Short-circuit when args already include `wait-for-device`. |
| H4 | ✅ `0e81d9f` | `src/cli/serve.ts` | 97-103 | Banner advertises "paste into Claude Desktop" but Claude Desktop can't consume `{ "url": "..." }`. Either drop the Claude Desktop mention or print *both* the SSE-direct snippet and the `mcp-remote` bridge snippet. |
| L3 | ✅ `0e81d9f` | `src/cli/serve.ts` | 99-104 | Banner JSON missing the outer `"mcpServers": { … }` wrapper. Verbatim paste = invalid config. |
| M1 | ✅ `c976ed1` | `PRIVACY.md` | new section | CLAUDE.md mandates a privacy-policy review when adding network-reachable capability. Add a section: remote mode + first-launch PyPI fetch via `uvx`. |

### Investigate, then either fix or document

| ID | Status | What | How to verify |
|---|---|---|---|
| C3 / OQ2 | 📝 `5055dbc` (documented) | Does `mcp-proxy --pass-environment` propagate to the **backend** subprocess, or only to `mcp-proxy` itself? Does it leak secrets that should be allowlisted? | `ANDROID_HOME=/tmp/nope replicant-mcp serve --http`, drive a tool call from a client, check whether the error references `/tmp/nope`. |
| OQ1 | 📝 `5055dbc` (documented) | Does mcp-proxy forward signals to the grandchild node? | `serve --http`, `kill -TERM <proxy-pid>`, then `pgrep -f "node dist/index"` should be empty. |
| OQ3 | 📝 `5055dbc` (documented) | If only the inner node dies, does mcp-proxy hang or recover? | `serve --http`, find inner node PID, `kill -KILL`, then call a tool from the client. |
| L2 | ⏳ deferred | `claude mcp add … --transport sse` — flag still current? Or has it been renamed/replaced? | `claude mcp add --help` on the latest CLI. Update or hedge `docs/remote.md`. |

> **Status legend:** ✅ fixed in code · 📝 documented (no code fix) · ⏳ deferred to a follow-up. Commit refs are on the `fix/remote-mode-review` branch. The C3/OQ1/OQ3 entries are accepted-as-documented per `docs/remote.md` "Process supervision and environment"; live smoke-tests still recommended before merge.

### Lower priority — picked up but defer if time-pressed

H2 (`runServe` returns immediately; lifecycle isn't awaited), H3 (test mocks pass even when the code under test is broken), M2 (IPv4 regex too lax — accepts `999.999.999.999`), M3 (transient-error regex misses empty-quoted serials and `error: closed`), M4 (`checkUvAvailable` swallows non-ENOENT failures), M5 (`process.argv[1] ?? ""` silent fallback), M6 (`mockResolvedValue` where `mockResolvedValueOnce` is needed in pre-existing logcat/pull tests), M7 (missing test for "CLI succeeds with no IPv4 lines"), M8 (signal handlers reach the global `process` instead of via `ServeDeps`), L1 (`--http` flag is awkward as required-but-default-false), L4 (`tmux` recipe doesn't address SIGHUP-on-detach), L5 (DECISIONS.md elides `--port`/`--host` in args description), L6 (Unicode box-drawing won't render on Windows `cmd.exe`), N1-N4 (style nits).

---

## Files in scope

- `src/cli/serve.ts` (new, the bulk of the changes)
- `src/services/tailscale.ts` (new)
- `src/adapters/adb.ts` (retry helper added)
- `tests/cli/serve.test.ts` (new)
- `tests/adapters/adb.test.ts` (new "transient-error retry" describe block)
- `tests/services/tailscale.test.ts` (new)
- `docs/remote.md` (new)
- `docs/architecture.md`, `README.md`, `DECISIONS.md`, `PRIVACY.md` (touched / should-be-touched)

---

## Critical

### C1 — `formatBanner` is written to stdout, which **is** the MCP transport in stdio mode

**File:** `src/cli/serve.ts:121`, `:157`
**Confidence:** HIGH

`runServe` calls `deps.log(formatBanner(...))` and the production `log` is `process.stdout.write`. Then `spawnChild("uvx", args, { stdio: "inherit" })` is wired with stdio inheritance. mcp-proxy itself logs to **stderr**, but as soon as the user runs `replicant-mcp serve --http` from a context where stdout is being consumed (e.g. piped into a launchd `StandardOutPath` log file — fine, harmless; but more importantly, if a future client ever wraps `replicant-mcp serve --http` over stdio the banner pollutes the channel), or where the parent shell shares stdout with another tool, you have non-MCP bytes on a stream that the rest of the project goes to great lengths to keep clean (see `docs/plans/2026-02-10-prod-readiness-dispatch.md:122` — "log.txt has output, stdout clean").

More importantly *right now*: the **inherited** stdout is shared with mcp-proxy, which forks the **grandchild** `node dist/index.js`. The grandchild's stdio is **not** inherited from the *grandparent* — mcp-proxy pipes the grandchild's stdio because that's how stdio bridging works. So strictly speaking you're not corrupting the MCP wire today. But the principle the codebase has held — *the CLI never writes to stdout when it might be consumed as a transport* — is broken here, and it sets a footgun for the next change.

**Fix:** Print the banner to **stderr**, not stdout. Change `log: (line) => process.stdout.write(line + "\n")` → `process.stderr.write(...)`, and rename `log`/`errLog` to `info`/`error` (or just drop `log` and use `errLog` everywhere — there's no reason for serve mode to ever write to stdout). The tests that assert `out.join("\n")` should move to asserting `err.join("\n")`.

---

### C2 — Signal handlers race the spawn: SIGINT in the window before `child` exists kills only the child handle, not the proxy tree

**File:** `src/cli/serve.ts:123-130`
**Confidence:** HIGH

The order is:
1. `const child = deps.spawnChild("uvx", args);` — synchronous, returns a `ChildProcess` object immediately, but the `uvx` binary may not yet be `exec`'d.
2. `for (const sig of signals) process.on(sig, () => { if (!child.killed) child.kill("SIGTERM"); })`

Two real problems:

a. **Closure captures `child` correctly** (so the variable race I'd normally worry about isn't here), but if SIGINT arrives between `spawn()` returning and the OS having `fork+exec`'d, `child.kill("SIGTERM")` may target a process that hasn't replaced its image yet, or — worse on Linux — may signal the right PID but the parent never installs an `exit` listener (the `child.on("exit", ...)` is registered *after* the signal loop). If the child crashes/exits during this window, no `deps.exit()` is called and the parent hangs.

b. **`child.killed` is the wrong gate.** Per the Node docs, `child.killed` flips to `true` after **we** call `child.kill()` *successfully sending the signal*, regardless of whether the child actually died, and stays true forever. So if SIGINT fires twice (user mashes Ctrl-C), the second one is correctly de-duped, fine. But if the proxy ignores SIGTERM (mcp-proxy itself does forward signals, but during shutdown it can take a few seconds to drain SSE clients), pressing Ctrl-C again — which a user **will** do — does nothing. There's no SIGKILL escalation.

Also: there is no `removeListener` on shutdown. If anything in this process ever loads `serve` more than once (e.g., a future test that calls `runServe` twice), listeners pile up.

**Fix sketch:**
```ts
let shuttingDown = false;
const onSignal = (sig: NodeJS.Signals) => {
  if (shuttingDown) {
    // Second Ctrl-C: escalate
    child.kill("SIGKILL");
    return;
  }
  shuttingDown = true;
  child.kill(sig);
  // SIGKILL escalation if proxy doesn't exit in 5s
  setTimeout(() => child.kill("SIGKILL"), 5000).unref();
};
for (const sig of signals) process.once(sig, () => onSignal(sig));
child.once("exit", () => {
  for (const sig of signals) process.removeListener(sig, onSignal);
});
```

And register the `exit`/`error` listeners on `child` **before** the signal loop, so a synchronous `error` event from a failed spawn doesn't get lost.

---

### C3 — `--pass-environment` propagates `REPLICANT_LOG_LEVEL=debug` and any future debug-mode env vars into the spawned backend, which can flood stderr the proxy is logging through

**File:** `src/cli/serve.ts:82` (`buildProxyArgs`)
**Confidence:** MEDIUM (turning HIGH if you ever ship a noisy debug mode)

`mcp-proxy --pass-environment` does propagate the parent process's env to the **backend** (the `<node> <self>` after `--`), not just to mcp-proxy itself. That's by design — you need `ANDROID_HOME`, `PATH`, etc. on the backend.

But this is also how `REPLICANT_LOG_LEVEL=debug` and `REPLICANT_LOG_FORMAT=json` (set on the host process for serve-mode debugging) silently get inherited by the stdio backend. When the backend logs to stderr, mcp-proxy pipes that stderr to *its* stderr (which is inherited from the parent again). If the user did `REPLICANT_LOG_LEVEL=debug replicant-mcp serve --http` to debug the *proxy* layer, they get a firehose of backend-level debug logs interleaved.

More concerning: there's **no env scrubbing**. Any of the following get passed through unfiltered:

- `REPLICANT_CONFIG` — could point at a config file the user expected only the proxy to see (not really, since the backend is the one that needs it, but worth thinking about).
- Random secrets in `~/.zshrc`-exported env vars (`OPENAI_API_KEY`, `GITHUB_TOKEN`, etc.). Yes, the backend is **local** and trusted, so this isn't a remote-leak — but the principle the project has been holding (`PRIVACY.md`: "does not transmit data to any external server") deserves a moment of thought, since the *proxy itself* is the new external surface.

**Fix:** Either (a) drop `--pass-environment` and instead pass only an explicit allowlist via `--env KEY=VALUE` (mcp-proxy supports per-key env injection), or (b) document in `docs/remote.md` what gets passed through and why. At minimum, mention in `docs/remote.md:117` (CLI reference section) that `--pass-environment` is in effect, so a security-conscious user knows.

The "right" answer is probably an allowlist of `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `PATH`, `HOME`, `REPLICANT_*`. Anything else is noise or risk.

---

## High

### H1 — `transient-error retry` collides with `AdbAdapter.waitForDevice` (recursion + timeout doubling)

**File:** `src/adapters/adb.ts:110-112` and `:127-136`
**Confidence:** HIGH

`waitForDevice` calls `this.adb(["-s", deviceId, "wait-for-device"], timeoutMs)`. If the device is offline at that moment, `adb wait-for-device` will *block* until the device comes back or the timeout fires; it does **not** return "device offline" the way other commands do. So in normal operation this is fine.

But: if the user calls `waitForDevice` on a device that's `unauthorized` (returns immediately with "device unauthorized") — the early-return on unauthorized correctly skips the retry. ✅
If the user calls `waitForDevice` on a device whose `id` is wrong and adb returns `device 'X' not found` → `isTransientDeviceError` returns `true` → we hit the retry path → we call `runAdb(["wait-for-device"], { timeoutMs: 3000 })` (with **no `-s` flag, so it waits for *any* device**) → then re-run the original `wait-for-device -s X` with the **same** `timeoutMs` as the first call. So a `waitForDevice("nonexistent", 30000)` call now takes up to **30s + 3s + 30s = 63s**. That's not "one retry with 3s budget"; it's a near-doubling of worst-case latency.

The retry helper does **not** recurse into itself (the inner calls go through `this.runner.runAdb` directly, bypassing `this.adb`), so no infinite recursion. ✅

Also worth flagging: the wait-for-device retry call does **not** include `-s <deviceId>`. That means on a multi-device host, `wait-for-device` will return the moment *any* device is online — which may not be the one we care about, and the subsequent retry then immediately fails again on "device 'X' not found". The retry effectively becomes a 3-second sleep for multi-device users.

**Fix:** Extract `deviceId` from `args` (it's right after `-s` if present), and pass it through: `runAdb(["-s", deviceId, "wait-for-device"], { timeoutMs: 3000 })`. Also add a fast-path: if the original args already start with `wait-for-device` or contain it, **don't** retry — the user is already waiting.

```ts
private async adb(args: string[], timeoutMs?: number): Promise<RunResult> {
  const first = await this.runner.runAdb(args, { timeoutMs });
  if (first.exitCode === 0 || !isTransientDeviceError(first)) return first;
  if (args.includes("wait-for-device")) return first; // no point retrying a wait
  const sIdx = args.indexOf("-s");
  const waitArgs = sIdx >= 0 && args[sIdx + 1]
    ? ["-s", args[sIdx + 1], "wait-for-device"]
    : ["wait-for-device"];
  await this.runner.runAdb(waitArgs, { timeoutMs: 3000 }).catch(() => {});
  return this.runner.runAdb(args, { timeoutMs });
}
```

---

### H2 — `runServe` returns immediately after `spawnChild`; `runServe`'s caller can't `await` the proxy lifecycle

**File:** `src/cli/serve.ts:110-143`
**Confidence:** HIGH

`runServe` is `async`, but it resolves the moment the signal/exit listeners are wired up. The proxy is still running. The action handler at `:151-162` `await`s `runServe(...)` — so commander's action returns, commander does no further work, and the process stays alive only because:
- the `child` keeps an active handle, AND
- the `process.on(sig, …)` listeners are active references.

This works, but it's load-bearing-by-accident. If anyone ever adds something like `program.parseAsync(...).then(() => process.exit(0))` — common in commander codebases — the proxy gets killed. Also, the test at `tests/cli/serve.test.ts:142-155` calls `await runServe(baseOpts(), deps)` and then immediately asserts `expect(spawn).toHaveBeenCalledWith(...)`. That works because the test passes `signals: []`, so no `process.on` listeners actually accumulate. But the *production* path is leaving listeners on the global `process` event emitter that are never removed (see C2 fix sketch).

**Fix:** Return a `Promise<number>` from `runServe` that resolves with the exit code when the child exits, and let the caller decide whether to `process.exit()`. This also makes the function genuinely testable end-to-end:

```ts
return new Promise<number>((resolve) => {
  child.once("exit", (code, sig) => resolve(sig && !code ? 0 : (code ?? 1)));
  child.once("error", (err) => { deps.errLog(...); resolve(1); });
});
```

And in the caller, `process.exit(await runServe(...))`.

---

### H3 — `tests/cli/serve.test.ts:142-155` doesn't actually test the lifecycle it claims to

**File:** `tests/cli/serve.test.ts:142-155`, `:167-181`
**Confidence:** HIGH

The "spawns uvx mcp-proxy" test calls `await runServe(baseOpts(), deps)` and asserts `expect(spawn).toHaveBeenCalledWith(...)`. Because of H2, `runServe` resolves before the child has been emit'd anything. The assertion passes — but only because `spawnChild` is invoked synchronously. The test doesn't constrain that the process did *anything* useful after spawning.

The "propagates child exit code" test (`:167-173`) does `child.emit("exit", 7, null)` **after** `runServe` resolves. Today this works because `child.on("exit")` is wired before `runServe` returns. But this is a tautology dressed up as a test — it asserts that an event listener you can see in the source registered correctly. It does **not** assert that `runServe` would, say, stop the process from hanging if the child exits. Same for the SIGTERM test.

The "uses --host override path" test (`:192-199`) asserts `expect.arrayContaining(["--host", "10.0.0.5"])` — but `arrayContaining` doesn't enforce ordering or exclusivity, so this passes even if the args were `["--host", "100.64.1.42", "--host", "10.0.0.5"]` (i.e., if both Tailscale autodetect *and* the override were applied). Worth tightening to `expect.arrayContaining` over a stricter sub-sequence or just `toEqual` on the whole array, because a buggy `preflight` that didn't short-circuit on `options.host` would still pass.

**Fix:**
1. Convert `runServe` to a proper promise that resolves on child exit (H2), and have the tests `await` that promise after `child.emit("exit", ...)`.
2. Replace `arrayContaining(["--host", "10.0.0.5"])` with a check that `100.64.1.42` is **not** in the args.
3. Add a test that asserts `signals` listeners are removed after the child exits (regression for the leak in C2).

---

### H4 — `formatBanner` advertises `"replicant-remote": { "url": "..." }` — but Claude Desktop **cannot** consume that

**File:** `src/cli/serve.ts:97-103`, `docs/remote.md:55-64`
**Confidence:** HIGH

The banner says: "Client config (paste into Claude Desktop / Cursor / etc.)" and prints a `{ "url": "..." }` block. Claude Desktop, as of 2026, **does not** support `url`-only stdio bridges natively — it requires a stdio command (which is exactly why `docs/remote.md:80-87` correctly shows the `npx -y mcp-remote` bridge for Claude Desktop). So the banner contradicts the docs.

The banner snippet is correct for **Cursor** and **Windsurf**, which do support `url`. It's wrong for **Claude Desktop** (and for Claude Code via the older config format). The "paste into Claude Desktop" claim will produce a broken config 100% of the time.

**Fix:** Either (a) drop the "Claude Desktop" mention from the banner and just say "(Cursor / Windsurf — for Claude Desktop see docs/remote.md)", or (b) print *both* snippets. (a) is much shorter.

---

## Medium

### M1 — `PRIVACY.md` is now stale; remote mode opens a new network surface and `PRIVACY.md` still says "Replicant MCP runs entirely on your machine"

**File:** `PRIVACY.md:24-26`
**Confidence:** HIGH

Per `CLAUDE.md`, "Privacy Policy must be reviewed when adding any external network calls or new data flows." `serve --http` listens on a network interface and accepts MCP traffic from another machine. Even on Tailscale, that's a new data-flow channel that the policy doesn't cover. The current diagram is:

```
Android device  -->  Replicant MCP (local)  -->  AI assistant
```

In remote mode the actual flow is:

```
Android device --> Replicant MCP (host) --> mcp-proxy (host) --> network --> AI agent
```

`PRIVACY.md:26` claims "It does not transmit data to any external server, and it does not include telemetry, analytics, or crash reporting." Strictly that's still true — *replicant-mcp* doesn't initiate outbound traffic; clients pull from it. But "external server" is ambiguous; in remote mode the host *is* a server.

Also: `uvx mcp-proxy` on first run **fetches the `mcp-proxy` package from PyPI**. That's a third-party network call from the host. `PRIVACY.md` should mention this, even briefly.

**Fix:** Add a section to `PRIVACY.md`:
- Remote mode (`serve --http`) makes replicant-mcp reachable on the host's Tailscale interface; data flows over WireGuard to the configured client.
- First launch downloads `mcp-proxy` from PyPI via `uvx`.
- No telemetry is added.
Either flag this in the PR description or update inline. Greptile will flag it otherwise.

---

### M2 — `detectTailscaleIp` IPv4 regex accepts invalid octets like `999.999.999.999`

**File:** `src/services/tailscale.ts:4`
**Confidence:** HIGH

`/^(?:\d{1,3}\.){3}\d{1,3}$/` matches "999.999.999.999" — that's a syntactically-valid match. In practice this is harmless because:
- The CLI path (`tailscale ip -4`) only emits valid IPs, so the regex is a no-op filter on real input.
- The interface fallback gets `entry.address` from `os.networkInterfaces()`, which Node guarantees is a valid IPv4 string for `family === "IPv4"`.

So no actual exploit. But the boundary check at `:13` (`a === 100 && b >= 64 && b <= 127`) **does** rely on `parseInt` returning a sane number, and `parseInt("999", 10) === 999`, which then fails the `b <= 127` check anyway. Self-correcting.

The **failure mode** is more subtle: if `tailscale ip -4` ever returns a malformed line (e.g., a future `tailscale` version adds a "Suggestion: …" prompt to stdout), the regex would happily match and the function would return garbage. Strict octet validation is cheap insurance.

**Fix:** Either tighten the regex to `^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$` (ugly), or do `ip.split(".").every(o => +o >= 0 && +o <= 255)` after a basic `\d{1,3}` shape match.

---

### M3 — `isTransientDeviceError` regex `/device '[^']+' not found/` requires a **non-empty** quoted name

**File:** `src/adapters/adb.ts:145`
**Confidence:** MEDIUM

`adb` historically emits `error: device '' not found` when given `-s ''` (empty serial). The current regex `[^']+` (one-or-more) won't match. Probably not in the wild — replicant-mcp validates device IDs upstream — but worth using `[^']*` (zero-or-more) for completeness. Minor.

Also: ADB sometimes emits `error: device serial number 'X' not found.` (extra words) and `error: closed` for fully-detached USB. Neither is matched. The "USB flake" claim in `docs/remote.md:206-208` ("the next tool call may hit `device offline` once") is narrower than the docs imply.

**Fix:** Add `closed` and broaden the not-found regex to `/device (?:serial number )?'[^']*' not found/`. Or add a small comment listing what's *not* covered, so someone tracking down a flake later doesn't waste time.

---

### M4 — `checkUvAvailable` swallows non-ENOENT errors silently

**File:** `src/cli/serve.ts:31-38`
**Confidence:** MEDIUM

If `uv --version` runs but exits with `EACCES` (permission denied — happens when `uv` is on PATH but not executable), or hangs and times out, you get `false` with no diagnostic. The user sees "uv (the Python package runner) is required" and re-installs uv, getting the same error.

**Fix:** Distinguish ENOENT from other failures:
```ts
catch (err) {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
  // surface other errors so the user knows uv is *there* but broken
  throw err;
}
```
Or at least log to `errLog` before returning false.

---

### M5 — `process.argv[1] ?? ""` for `selfBin` will silently spawn `node ""` if argv[1] is undefined

**File:** `src/cli/serve.ts:160`
**Confidence:** MEDIUM

`process.argv[1]` is the script path. It's only ever undefined if Node is invoked as `node -e '…'` or similar embedded contexts — which is essentially "never" for a CLI bin. But the fallback to `""` is silently wrong: `spawn("uvx", [..., "/usr/bin/node", ""])` would tell mcp-proxy to spawn `node ""`, which `node` would interpret as "read empty path" and either error out or hang depending on platform.

**Fix:** Throw a clear error if `process.argv[1]` is missing:
```ts
selfBin: process.argv[1] ?? (() => { throw new ReplicantError(ErrorCode.INTERNAL, "argv[1] missing"); })(),
```

Better yet: resolve via `import.meta.url` → `fileURLToPath` so it works regardless of how `argv[1]` is set.

---

### M6 — Tests use `mockResolvedValue` (sticky) where `mockResolvedValueOnce` is needed to prove retry semantics

**File:** `tests/adapters/adb.test.ts` — `logcat` and `pull` blocks use `mockResolvedValue`
**Confidence:** HIGH

`mockResolvedValue` returns the same result for every call. The retry logic in `AdbAdapter.adb` makes **up to 3 calls** (original, `wait-for-device`, retry). Tests like `tests/adapters/adb.test.ts:79-86`:
```ts
mockRunner.runAdb.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
await adapter.logcat("emulator-5554", { since: "01-20 15:30:00.000" });
expect(mockRunner.runAdb).toHaveBeenCalledWith(
  expect.arrayContaining(["-T", "01-20 15:30:00.000"]),
  expect.anything()
);
```
…would still pass even if the implementation called `runAdb` 17 times. The first call is what we care about, but the assertion uses `.toHaveBeenCalledWith` (matches *any* call), so a buggy retry that re-issued the original args repeatedly would slip through.

This isn't a regression from this PR — the existing tests have always been loose. But the PR adds a retry loop on the same code path, so the looseness now matters. The new "transient-error retry" block at `:158-225` does correctly use `mockResolvedValueOnce`, so that part is fine.

**Fix (low effort):** in the `logcat`/`pull` tests, change to `.toHaveBeenNthCalledWith(1, …)` to assert the *first* call's shape, or add `expect(mockRunner.runAdb).toHaveBeenCalledTimes(1)` to lock in "no retry happened on success."

---

### M7 — `tests/services/tailscale.test.ts` doesn't cover the "CLI exits 0 with whitespace-only stdout" case the prompt asked about

**File:** `tests/services/tailscale.test.ts`
**Confidence:** HIGH

The test for "CLI returns multiple addresses" at `:27-35` covers IPv6 mixed with IPv4. There's no test for:
- `tailscale ip -4` exits 0 with stdout `"\n\n"` (no IPv4 lines) → should fall through to interface scan.
- `tailscale ip -4` exits 0 with stdout `"   100.64.1.42  \n"` (whitespace padding) → the `.trim()` at `tailscale.ts:25` should handle it; worth a test.
- `tailscale ip -4` exits 0 with stdout `"100.64.1.42"` (no trailing newline) → covered by the existing test? Yes, "100.64.1.42\n" is fine.

The current code at `:24-27` handles all of these correctly (the `.find` returns undefined on empty stdout, falls through). But the "CLI succeeded but produced no IPv4" branch is **not** exercised, and that's a real failure mode (e.g., tailscale CLI installed but `tailscaled` not running yet).

**Fix:** Add a test:
```ts
it("falls back to interfaces when CLI succeeds but emits no IPv4", async () => {
  const run = vi.fn().mockResolvedValue({ stdout: "fd7a:115c:a1e0::1\n", stderr: "", exitCode: 0 });
  const ifaces: IfaceMap = { utun3: [cgnat("100.64.1.42")] };
  const ip = await detectTailscaleIp(makeRunner(run), () => ifaces);
  expect(ip).toBe("100.64.1.42");
});
```

---

### M8 — `serve.ts:127` registers signal handlers on the **global `process`**, not via `deps`

**File:** `src/cli/serve.ts:127`
**Confidence:** HIGH

The `ServeDeps` injection pattern is otherwise tidy — `runner`, `detectIp`, `spawnChild`, `exit`, `log`, `errLog` are all injectable. But `process.on(sig, …)` reaches out to the global. This means:
- Tests can't observe what handlers got registered without monkey-patching `process`.
- The `signals: []` test workaround (`tests/cli/serve.test.ts:135`) only works because we **don't** call `process.on` when the array is empty. This is a code path that exists *just for testing*.
- Multiple `runServe` invocations in one process leak listeners (see C2).

**Fix:** Add `processOn: typeof process.on` and `processOff: typeof process.removeListener` to `ServeDeps`, default them to `process.on.bind(process)` / `process.removeListener.bind(process)`. Then tests can use a fake `EventEmitter` and assert listener cleanup.

---

## Low

### L1 — `serve.ts:148` declares `--http` as `false` default, but preflight rejects when it's false with "serve currently requires --http"

**File:** `src/cli/serve.ts:44-46`, `:148`
**Confidence:** HIGH

The `--http` flag is currently the only mode `serve` supports. Making it required-but-implicit is awkward — `replicant-mcp serve` exits with an error message that essentially says "you ran serve wrong, use serve --http". For a single-mode subcommand, just default `--http` to `true` and document that `replicant-mcp serve` and `replicant-mcp serve --http` are equivalent. Or omit the flag entirely until you actually have a second mode.

The current shape is a "future-proofing" tax that the user pays today. Pick one:
- (a) Keep the flag, default it to `true`, change the description to "(default; future-proof for stdio mode)".
- (b) Drop the flag now, add it back when you actually ship a second mode.

I'd pick (b). Less code, less docs, no breaking change later (since adding a new flag with a sensible default is non-breaking).

---

### L2 — `docs/remote.md:104` `claude mcp add … --transport sse` may be stale syntax

**File:** `docs/remote.md:101-105`
**Confidence:** LOW

As of late 2025/2026, the Claude Code CLI's `mcp add` syntax is `claude mcp add <name> <command…>` for stdio and `claude mcp add --transport http <name> <url>` for HTTP. The flag is `--transport`, with values `stdio | sse | http` historically; some recent docs deprecate `sse` in favor of `http` (streamable HTTP transport, which mcp-proxy also supports on `/mcp` rather than `/sse`).

I'm not certain the `--transport sse` flag is still preferred. Two things to verify before merge:
1. That `claude mcp add` accepts `sse` as a transport value in the current CLI.
2. That `mcp-proxy`'s SSE endpoint is at `/sse` (the docs say so; worth confirming for the mcp-proxy version that `uvx` will pull).

This is a "needs verification" flag, not a defect.

**Fix:** Either run `claude mcp add --help` on the current CLI and confirm, or hedge in the docs: "Check `claude mcp add --help` for the current transport flag — `sse` was the value as of 2026-05."

---

### L3 — `formatBanner` JSON snippet wraps `"replicant-remote"` at the **top level**, but real MCP configs nest it under `"mcpServers"`

**File:** `src/cli/serve.ts:99-104`
**Confidence:** HIGH

The banner prints:
```json
{
  "replicant-remote": {
    "url": "http://..."
  }
}
```

But every real client config (Cursor, Claude Desktop, Windsurf) wraps server entries under `"mcpServers"`:
```json
{
  "mcpServers": {
    "replicant-remote": { ... }
  }
}
```

A user who copy-pastes the banner verbatim gets a config that nothing parses. The docs in `docs/remote.md:78-99` show the correct nesting; the banner does not.

**Fix:** Add the `"mcpServers"` wrapper to the banner snippet. Or print just the inner object and label it "Add this entry to your `mcpServers` block".

---

### L4 — `docs/remote.md:194-201` recommends `tmux new -s replicant 'replicant-mcp serve --http'` but doesn't address the SIGHUP-on-detach behavior

**File:** `docs/remote.md:194-201`
**Confidence:** LOW

Detaching a tmux session (`Ctrl-b d`) doesn't send SIGHUP to the inner process — tmux owns the pty. So this is fine. But if the user instead used `nohup` or a bare `&` shell job, the parent shell exit would SIGHUP the chain and uvx might not handle it cleanly. The docs are correct as written; just flagging that "Quick / temporary" should explicitly *not* recommend `&`.

No fix required, but if you ever expand the section, mention this.

---

### L5 — `DECISIONS.md:213` says "spawns mcp-proxy with `--pass-environment -- <node> <self>`" — but the actual args order is `--port … --host … --pass-environment -- <node> <self>`

**File:** `DECISIONS.md:213` vs `src/cli/serve.ts:77-87`
**Confidence:** HIGH

Minor doc accuracy nit. The decision entry summarizes the args list and omits `--port` / `--host`. It's not misleading — those are obvious — but for a decision log that will be referenced later, the elision could mislead a reader into thinking `--pass-environment` is the *only* flag. Worth a one-word fix: "spawns mcp-proxy with `--port`, `--host`, `--pass-environment`, then `-- <node> <self>`".

---

### L6 — Banner uses Unicode box-drawing character `─────────────────────────`

**File:** `src/cli/serve.ts:92`
**Confidence:** LOW

Won't render correctly on Windows `cmd.exe` without UTF-8 codepage. PowerShell handles it; Windows Terminal handles it. Old `cmd.exe` shows mojibake. Project `DECISIONS.md:94-99` (Windows SDK and PATH discovery support) shows a stated goal of Windows compatibility.

**Fix:** Use ASCII `-----` instead, or guard with `process.platform`. Honestly, just `-----` looks fine.

---

## Nit

### N1 — `src/services/tailscale.ts:32` comment refers to "tun interface" but `utun*` is macOS BSD-style, `tailscale0` is Linux

The comment is fine but slightly misleading. macOS uses `utun3`, `utun4`, etc.; Linux uses `tailscale0`. The fallback works for both because it scans by IP range, not interface name. Worth a one-word amend in the comment.

### N2 — `serve.ts:163` — trailing blank line at end of file is fine but inconsistent with other files in the repo (most end with a single `\n` and no blank line)

Minor style.

### N3 — `tests/cli/serve.test.ts:124-125`

```ts
const spawn = over.spawnChild
  ? (vi.fn(over.spawnChild) as unknown as ReturnType<typeof vi.fn>)
  : vi.fn(() => new FakeChild());
```

The `as unknown as ReturnType<typeof vi.fn>` cast is doing nothing useful here — the conditional already gives back a `vi.fn`. Drop the cast.

### N4 — `docs/remote.md:165` systemd unit references `tailscaled.service` in `After=`, but on a user unit (`--user`) you can't `After` system-level services. Either drop that or move the unit to system scope.

---

## Open questions

### OQ1 — Does mcp-proxy correctly forward SIGTERM to the **grandchild** stdio backend?

**Confidence:** LOW

If `serve --http` gets SIGTERM, it sends SIGTERM to `uvx`/`mcp-proxy`, which should forward to the backend `node dist/index.js`. If mcp-proxy doesn't forward signals (or forwards but doesn't `wait()`), the backend orphans and the host accumulates zombie node processes. Worth a manual test: `replicant-mcp serve --http`, get the proxy PID, `kill -TERM <proxy>`, check `pgrep -f "node dist/index"` is empty.

### OQ2 — Does `--pass-environment` cover only mcp-proxy's own env, only the backend's, or both?

**Confidence:** LOW

The mcp-proxy README I'm familiar with says `--pass-environment` propagates the parent's environment to the **named server** (the backend). I can't 100% verify against the version `uvx` pulls without running it. If it only sets mcp-proxy's env, the backend won't see `ANDROID_HOME` and adb commands fail with "Android SDK not found." Worth a smoke test: run `serve --http` from a shell where `ANDROID_HOME=/tmp/nope`, then have a client call `adb-device list`, confirm the error message references `/tmp/nope`.

### OQ3 — If the backend stdio MCP server crashes (e.g., uncaught exception in a tool), does mcp-proxy auto-respawn it, or does the SSE connection just hang?

**Confidence:** LOW

`docs/remote.md:212-213` claims "`launchd`/`systemd` restarts the host process; the agent sees the connection drop and reconnects." But that's only if the *whole tree* dies. If only the inner node process dies and mcp-proxy survives, the SSE socket is open but every tool call hangs. mcp-proxy's behavior here matters and isn't documented. Worth a test: send `kill -KILL` to the inner node PID and observe.

---

## Positive observations

- `ServeDeps` dependency injection is clean — most of `serve.ts` is testable without monkey-patching globals (M8 is the one omission).
- Two-tier Tailscale detection (CLI first, interface scan fallback) is the right shape; covers the common case fast and degrades gracefully.
- CGNAT boundary tests in `tests/services/tailscale.test.ts:77-93` are exactly what I'd want — explicit boundary cases for `100.63.255.255` and `100.128.0.1` (out) and `100.64.0.0` / `100.127.255.255` (in).
- Retry helper is correctly bounded at one retry, doesn't recurse, and the `unauthorized` early-return is ordered before the transient-error checks. Intent is right; only the wait-for-device call shape needs adjustment (H1).
- DECISIONS.md entry at `:210-215` is high-quality: states alternatives considered (reimplement transport, separate install, Docker, bearer auth) and why each was rejected.
- Stdio mode unchanged — the smart router at `src/index.ts:3-22` and the existing stdio path are untouched. Good blast radius discipline.
- `docs/remote.md` "What happens when the phone disconnects" section at `:204-217` is genuinely useful operator documentation.
