# Wireless ADB — Stage 4: Background supervisor

## Goal

Detect and recover from connection loss **without** a triggering tool call. This is what enables the unattended-device use case: a phone left at home reachable through Wi-Fi blips, deep-sleep cycles, and DHCP renewals — the supervisor reconnects on its own and the next agent call just works.

## What it adds

- **Long-running watcher** in the MCP server process that periodically (configurable interval, default ~30s) iterates the **supervised set** (introduced in Stage 3 — distinct from the endpoint cache; see Stage 3's "Cache vs. supervision intent" note). For each fingerprint in the supervised set, the watcher detects:
  - The device transitioning to `offline` in the device table.
  - The device disappearing entirely.
  Devices the user has explicitly disconnected are **not** in the supervised set and are **not** auto-reconnected. This is the load-bearing design choice: without it, the supervisor would silently undo every `disconnect`.
- **On detection, attempts reconnect** using only mechanisms that already work without speculative identity claims:
  1. Last-known endpoint from the Stage 3 cache (matched by fingerprint). The cache holds exactly one address per fingerprint; there is no multi-endpoint fan-out. **Lock semantics are identical to step 2**: extract the host from the cached `lastKnownAddress`, `tryAcquireHost(host, ~250ms)` (if contended, defer to the next interval), connect to the cached address, `verifyDevice`, and on fingerprint match call `transferAlias(release, host, fp)` (which is a no-op fast path when the alias already maps `host → fp` from a long-lived server — see Stage 1's `transferAlias` already-bound case). On failure (connect failure, verify failure, fingerprint mismatch) release the host lock and fall through to step 2. **Why `tryAcquireHost`, not `tryAcquireFingerprint(fp)`:** the alias map (`hostToFingerprint`) is in-memory and starts empty on every server restart, so a fingerprint-keyed supervisor lock would not serialize against a foreground `connect`/`pair` to the cached host (which acquires `lock(host)` when the alias is unbound). Symmetric `tryAcquireHost` serializes correctly whether the alias is bound or not.
  2. mDNS scan: collect candidates (each is `{ mdnsServiceName, address }` per Stage 3 — `address` is `host:port`). For each, take the host portion of `address` and **`tryAcquireHost(host, ~250ms)`** — Stage 1 keys this lock on the bare IP (not the full endpoint), so the supervisor and foreground `pair`/`connect` on the same physical device share one lock. If the host lock is contended, skip the candidate (a foreground tool call has it; the supervisor defers per the never-block-foreground invariant); otherwise connect to `address` → run `verifyDevice` → if the returned fingerprint matches the cache entry → `transferAlias` to the fingerprint lock and report success; on mismatch, disconnect **while still holding the host lock** (so the cleanup can't race a foreground `pair`/`connect` that grabs the lock in a release-then-disconnect gap and gets torn down by the supervisor's `adb disconnect <address>`), then release the host lock and try the next candidate. (mDNS itself does not expose serial/model — identity is only confirmed post-connect, per Stage 3's identity strategy.)
  3. Exponential backoff with jitter on repeated failures (e.g., 5s, 15s, 60s, 5min, 15min, capped).
- **Opt-in via config**, off by default. A config flag in `src/services/config.ts` enables the supervisor. Lifecycle bound to MCP server process — stops cleanly on shutdown.
- **Event log** of supervisor actions feeds Stage 5 observability.

## Dependencies

- **Stage 3's supervised set** — the source of truth for which fingerprints to watch. The supervisor never iterates the cache directly.
- **Stage 3's endpoint cache** — without persistent endpoints, the supervisor has nothing to reconnect to after a port change.
- **Stage 3's identity strategy** — fingerprint confirmation post-connect is what makes mDNS rediscovery safe.
- **Stage 1's adapter primitives** for the connect/verify path.
- **Stage 1's per-device lock** — supervisor uses `tryAcquireHost(host, ~250ms)` for both step 1 (cached endpoint) and step 2 (mDNS scan); on contention, the supervisor defers to the next interval rather than blocking, so foreground tool calls always win. Post-verify, `transferAlias` switches the supervisor onto `lock(fp)` for any tail work — with the no-op fast path when the alias is already bound (long-lived servers), so an mDNS rediscovery of the cached host doesn't re-acquire a held lock.
- **Stage 2's recovery sequence** as the inner reconnect step.

## Key design notes

- **The supervisor is not an MCP tool.** Agents do not call it. It runs as part of the server. (This is why Stage 1 deliberately did not expose `recoveryMode` or similar MCP-level escape hatches: the supervisor uses internal APIs on `AdbAdapter` directly.)
- **Cooperate via the Stage 1 per-device lock.** When a tool call is in flight against a wireless device, the supervisor `tryAcquire`s the lock with a short timeout; if it fails, defers to the next interval rather than blocking. This avoids contention spikes during active sessions.
- **Backoff with jitter** to avoid synchronised reconnect storms when multiple devices come online together.
- **Bounded retry budget per device per hour** — eventually give up and report rather than hammer.
- **No silent endpoint changes.** If the supervisor reconnects under a new endpoint, the cache updates and the event log records the change; the agent's next `list` reflects reality.
- **Tested via fake clock + simulated adb output**, not against real network conditions in unit tests.

## Out of scope (still deferred)

- Cross-machine supervisor coordination (e.g., one host watching multiple remote phones).
- Push-style notifications when a device returns online (would require a sidecar or webhook surface). Stage 5 may add a polling endpoint instead.
