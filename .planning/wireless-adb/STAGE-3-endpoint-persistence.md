# Wireless ADB — Stage 3: Endpoint persistence & smart discovery

## Goal

Survive server restarts, context compaction, and IP renewals without re-pairing. The agent that connected to a device yesterday can reconnect today with `adb-device connect` (no args), even if the server process restarted.

## What it adds

- **On-disk endpoint cache**, keyed by **fingerprint** (defined in `CONTEXT.md` and computed in Stage 1's `src/services/identity.ts`), not raw `host:port`. This lets us recognise the same device under a new IP after DHCP renewal.
  - Stored under the OS-conventional user-data dir: `$XDG_DATA_HOME/replicant-mcp/wireless-adb/endpoints.json` (Linux, fallback `~/.local/share/...`), `~/Library/Application Support/replicant-mcp/wireless-adb/endpoints.json` (macOS), `%LOCALAPPDATA%\replicant-mcp\wireless-adb\endpoints.json` (Windows). Resolution lives in `src/services/paths.ts` (new) so the cache, supervised set, and any future state share one resolver and tests.
  - File permissions `0600`. The cache stores fingerprints (already hashed); raw serials never reach disk. The `0600` posture is belt-and-braces for `deviceLabel` and address history.
  - Each entry:
    ```ts
    {
      fingerprint: string;          // canonical fingerprint string (CONTEXT.md); raw serial never on disk
      lastKnownAddress: string;     // host:port, the connect address
      mdnsServiceName?: string;     // service-instance name observed at last mDNS scan, if any
      deviceLabel?: string;         // human label (model)
      firstSeen: number;            // epoch ms — for pruning ordering
      lastSeen: number;             // epoch ms — last successful verify
      failedVerifyCount: number;    // bumped on each consecutive failed verify, reset to 0 on success
    }
    ```
  - Pruned by age (entries unused for 30 days drop off) and by `failedVerifyCount` exceeding a tunable threshold.
- **`connect` (no args) consults the cache** — but **does not silently auto-pick** when more than one cached identity is viable. Algorithm:
  1. **Single cached fingerprint:** try its `lastKnownAddress`; if `verifyDevice` fails or its returned fingerprint doesn't match the cache entry, fall through to the Stage 1 mDNS scan. The cache stores exactly one address per fingerprint — no historical-address iteration. mDNS already covers the network-switch / DHCP-renewal case, and an iterated retry over stale addresses adds latency without materially improving success rate.
  2. **Multiple cached fingerprints:** return `MULTIPLE_WIRELESS_CANDIDATES` with one `nextSteps` entry per cached fingerprint (each pre-populated with `args: { operation: "connect", address: <lastKnownAddress> }`). This matches Stage 1's behaviour for ambiguity at discovery time and respects `DECISIONS.md`'s single-active-device decision — the server never silently routes to one of several plausible options.
  3. **No cached fingerprints:** Stage 1's no-args scan flow.

  Each `verifyDevice` call confirms `serial+model` matches the cache's fingerprint before the cache entry is "used"; on mismatch the address is invalidated for that fingerprint and the loop continues.
- **`list` is unchanged.** It does not surface cached candidates as success-path `nextSteps`. (`nextSteps` is reserved for error responses, per Stage 1's contract.) Cached-candidate discovery is the job of `connect` no-args; agents that want to see cached identities call `connect` with no args and read the response.
- **Cache write happens after a verified connect with confirmed fingerprint**: `verifyDevice` returns `{ ok, serial, model }` (introduced in Stage 1); only when both are present does the endpoint get cached.

### Identity strategy: how mDNS and fingerprint connect

This is the load-bearing piece for Stages 3-4. mDNS does **not** expose `ro.serialno` or `ro.product.model` — only a service-instance name (e.g., `adb-tls-connect._tcp` advertising `adb-XXXXXX-YYYYYY` where the suffix is derived from the device but not equal to its serial) and an address. So the lookup is two-phase:

1. **Discovery (cheap, no connect):** mDNS scan returns `{ mdnsServiceName, address }` records. We can match a record to a cache entry by `mdnsServiceName` if previously stored, or by `address` as a weaker hint.
2. **Confirmation (requires connect):** to know we have the same device, we must connect, run `verifyDevice`, and compare the returned `serial+model` against the cache's fingerprint. If they match, success; if not, this is a different device on the same address (port reused) — disconnect and fall through.

The cache stores both `mdnsServiceName` (cheap match) and `fingerprint` (authoritative match). No-args `connect` tries cache by mDNS-name match first, then the single `lastKnownAddress` for the matched fingerprint, then mDNS scan. (No multi-address brute-force — see "Single cached fingerprint" above.)

**`mdnsServiceName` is a hint, never authoritative.** It may rotate across phone reboots or factory resets — the format is upstream and not contractual. Every match must still be confirmed by `verifyDevice` returning a fingerprint that matches the cache entry; on mismatch, treat as cache miss and fall through. Worst case for an unstable name is one extra mDNS scan, never a wrong-device connection.

## Dependencies

- Stage 1's adapter primitives (connect, verify, mDNS).
- Stage 1's `transport` field.
- Stage 1's `verifyDevice` primitive returning `{ ok, serial, model, fingerprint }` — the only producer of fingerprints; cache writes use the returned `fingerprint` string verbatim.
- Stage 1's per-device lock — cache writes happen under the lock to avoid two connects racing on the same fingerprint.

## Key design notes

- **Fingerprint, not address.** IP changes are common; the fingerprint (per `CONTEXT.md`) is stable across reconnects, IP renewals, and reboots.
- **Stored fingerprint is the hashed canonical form** — `serial`/`model` raw values never reach disk. The hashing happens once in `src/services/identity.ts` (Stage 1); Stage 3 just stores what `verifyDevice` returned.
- **Cache is local-only.** No network sync. No cross-machine cache.
- **Privacy review required.** This is the first stage that introduces persistence; `PRIVACY.md` must be updated to document what's stored, where, file permissions, and the hashing scheme.
- **Cache vs. supervision intent are separate concepts.**
  - **Cache** = "I know how to reach this device if asked." Persists across disconnect; pruned by age/failure-count only.
  - **Supervised set** = "Background reconnect this device when it goes offline." Mutated by user intent: `connect`/`pair` add the resulting fingerprint to the supervised set; explicit `disconnect` removes it. The supervised set is what Stage 4 watches — never the cache directly. Without this separation, a user `disconnect` would be silently undone by Stage 4's supervisor 30s later.
  - The supervised set is **persisted to disk from Stage 3** (file `supervised.json` alongside the endpoint cache, same data dir, same `0600` permissions). It has no in-process consumer until Stage 4, but persistence is needed in Stage 3 because the set captures user intent (every successful `connect`/`pair` adds; explicit `disconnect` removes) and that intent must survive server restart — losing it on every restart defeats the goal of Stage 3 itself. Stage 4's supervisor reads the file at startup and observes mutations through the same in-process API the connect/disconnect handlers already call.
- **Explicit `disconnect` removes the device from the supervised set, but keeps the cache entry.** A disconnect is a session boundary; the cache entry remains so the next explicit `connect` (no-args or address-targeted) finds it. A separate `forget` operation can be added if real-world need emerges to drop the cache entry too.
- **Stale-entry handling.** Entries with `failedVerifyCount` above a threshold (e.g., 5) get pruned at next write. Tunable.

## Tests

- Cache hit on lastKnownAddress with matching fingerprint → connect succeeds, no mDNS scan.
- Cache hit on address but fingerprint mismatch → disconnect, fall through.
- Cache miss + mDNS hit by service name → connect, verify, write cache.
- `failedVerifyCount` increments on failed verify, prunes after threshold.
- File permissions on cache file are 0600 after write.

## Out of scope (still deferred)

- Background watching (Stage 4).
- Cross-machine endpoint sync.
- Cloud-side endpoint registry.
