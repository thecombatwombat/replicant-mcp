# Wireless ADB — Stage 1: Foundations

## Context

Branch `wireless-adb-support` is at the same commit as `master` — wireless ADB is not implemented. Today everything assumes USB or emulator devices: the parser doesn't recognise `host:port` device IDs, no code path issues `adb connect | disconnect | pair | mdns`, and the `Device` type has no transport distinction.

The product consumer is always an AI agent — never a human typing commands. Some of those agents will be smaller, simpler models. The wireless ADB surface has to make the right call obvious to a small model and never require it to know what ADB is.

## Goal

An agent can:
1. First-time-pair a wireless device with a single tool call.
2. Reconnect to a previously-paired device with a single tool call (or no-args "find and connect").
3. Disconnect cleanly.
4. Continue using every other replicant-mcp tool (`adb-shell`, `adb-app`, `adb-logcat`, `ui-*`) against the wireless device with no changes.
5. When something goes wrong, receive a structured response that names the exact next operation and arguments — no reasoning required.

Stage 1 makes wireless ADB *work*. Stages 2-5 make it *survive* time, networks, and unattended operation.

## Design principles

1. **Try the fast, usually-works path first.** No pre-flight checks, no defensive scanning before the first attempt.
2. **On failure, the server runs a deterministic fallback.** The agent never decides how to recover. The fallback is built from primitives an agent could in principle call, but never has to.
3. **The agent never sees ADB.** Tool descriptions, error messages, and `nextSteps` use domain terms — *device*, *address*, *pairing code*, *connection*. The word "adb" can appear once at the top of the tool description for orientation; nowhere else in agent-facing text.
4. **Failure responses tell the agent exactly what to do.** Structured `nextSteps` with each step marked *required* or *suggestion*, plus the operation name and ready-to-use arguments. The agent should not need to reason.
5. **One call, one decision.** Each operation does one job end-to-end. Optional parameters that force the agent to think are minimised.

## Tool surface

Three new operations on the existing `adb-device` tool:

| Operation     | Use when                                                              |
|---------------|-----------------------------------------------------------------------|
| `pair`        | Setting up a wireless device for the first time (have a pairing code) |
| `connect`     | Reconnecting to a previously paired device, or auto-discovering one   |
| `disconnect`  | Cleaning up wireless connections                                      |

No `mdns`, no transport flags, no recovery-mode parameter. Network scanning is internal.

## Operation behaviour

### `pair`

Pair-with-code is Android 11+. Pre-Android-11 devices use the legacy USB-bootstrapped TCP/IP flow, which is out of scope for Stage 1.

**Inputs:**
- `address: string` *(required)* — e.g., `"192.168.1.10:41234"` (the **pair** address shown on the phone's Wireless debugging screen).
- `pairingCode: string` *(required)* — six-digit code from the phone, expires within ~30 seconds.
- `connectPort: number` *(required)* — the **connect** port shown on the same screen. Different from the pair port. **Required** so `pair` always returns a fully-usable session in one call; if missing, the schema rejects with `INPUT_VALIDATION_FAILED` and the agent's tool description tells it to ask the user for all four values up front.

**Server flow:**
1. Pair using `address` + `pairingCode`.
2. On pair failure → return structured error.
3. On pair success:
   a. Compose connect address: take host portion of `address`, combine with `connectPort`.
   b. Run the `connect` flow (below).
   c. On full success → set the wireless device as current per "Current-device semantics" below; return `{ device, currentDevice, previousDevice }` (`previousDevice` may be `null`).
   d. On connect failure after pair success → return distinct error code `PAIR_OK_CONNECT_FAILED` so the agent doesn't re-pair (the device is now paired and would reject re-pairing with a fresh code).

This deliberately removes the "success plus `nextSteps`" branch that previously existed when `connectPort` was missing. Success responses carry no `nextSteps`; only error responses do. That keeps the wire contract simple: `nextSteps` is in the error envelope, not the per-tool output schemas.

### `connect`

**Inputs:**
- `address: string` *(optional)* — e.g., `"192.168.1.10:5555"` (the **connect** address).

**Server flow when `address` is provided:**
1. Acquire the per-device lock for `address` (see "Current-device semantics" below).
2. Quick path: connect to `address`.
3. Verify the connection via `verifyDevice` (3-5 second timeout, separate from the 120s shell cap).
4. On verify success → set the wireless device as current per "Current-device semantics" below; return `{ device, currentDevice, previousDevice }` (`previousDevice` may be `null`).
5. On verify failure or connect failure → run the canonical adb reset sequence (one attempt, not a loop):
   - Clear stale offline entries.
   - Force-disconnect the target.
   - Reconnect to the target.
   - Re-verify.
   On reset success → step 4. This is the documented adb recovery sequence; it is not a heuristic.
6. On reset failure → run an internal network scan and return a structured error listing discovered candidates as `nextSteps` with ready-to-call `args`. **Do not auto-retry with a discovered candidate** — same host with a different port does not reliably mean the same device. Decision belongs to the agent or its caller.

**Server flow when `address` is omitted:**
1. Internal network scan.
2. If exactly one wireless candidate found → connect-and-verify it (full flow above).
3. If zero candidates → structured error with `nextSteps` directing the agent to ask the user to enable Wireless debugging or to provide an address.
4. If multiple candidates → structured error listing all of them as `nextSteps`, each with ready-to-use `args` for `connect`.

### Current-device semantics (`pair` and `connect`)

Successful `pair` and `connect` set the wireless device as `currentDevice`, but **not silently**: the response always includes `previousDevice` (the prior `Device` or `null` if none was selected) so the agent can surface "switched from X to Y" to its caller. This avoids the surprise of an emulator session being clobbered without a trace. Implementation: `setCurrentDevice` returns the prior device, and the operation handler forwards it as `previousDevice` in the response. The agent's intent in calling `connect`/`pair` is unambiguous, so the switch itself is unconditional.

### `disconnect`

**Inputs:**
- `address: string` *(optional)*.

**Server flow:**
1. With `address` → acquire the per-device lock for that target, then disconnect. Idempotent (not-connected = success).
2. Without `address` → list current devices, then for each one whose `transport === "wireless"`: acquire its lock, disconnect. Idempotent.
3. After disconnect, if the current device was among the disconnected, call `clearAndAutoSelect(remainingDevices)` from `device-state.ts` (clears current, then `autoSelectIfSingle` picks a remaining device if exactly one is online). `autoSelectIfSingle` alone does not work here because it short-circuits when `currentDevice` is already set.
4. Return `{ disconnected: string[], currentDevice: Device | null }`.

## Error envelope

Today's `ReplicantError` (`src/types/errors.ts`) carries `code`, `message`, `suggestion?: string`, and a strictly typed `context?: ErrorContext` (`{ command?, exitCode?, stderr?, checkedPaths?, buildResult? }`). The wire shape is `ToolError` (`{ error, message, suggestion?, details? }`), produced by `toToolError()` and serialized in `server.ts`. **Both must be extended for `nextSteps` to actually reach the agent.**

The full set of changes:

1. Add `NextStep` interface and `nextSteps?: NextStep[]` field to `ReplicantError`.
2. Add `nextSteps?: NextStep[]` to the `ToolError` interface.
3. Update `ReplicantError.toJSON()` and `ReplicantError.toToolError()` to include `nextSteps`.
4. Extend `ErrorContext` with the wireless-specific fields used in the examples below (`address?: string`, `attempts?: number`, `deviceId?: string`, `discoveredCandidates?: { address: string; deviceLabel?: string }[]`). **Do not** widen to `Record<string, unknown>` — `ErrorContext` is currently a strictly-typed structural type; keep that property and add named optional fields instead of an index signature.
5. Update `scripts/generate-contract.ts` and any committed contract fixtures under `docs/contracts/` so the new shape is part of the public contract.

```ts
interface NextStep {
  action: string;                   // short human-readable label
  required: boolean;                // true = must do this, false = suggestion
  operation?: string;               // existing tool operation, e.g. "adb-device"
  args?: Record<string, unknown>;   // suggested arguments for the operation
  reason: string;                   // why this step helps
}

// Existing class — extended, not rewritten.
class ReplicantError extends Error {
  code: ErrorCode;
  message: string;             // inherited from Error
  suggestion?: string;         // EXISTING — one-line summary
  context?: ErrorContext;      // EXISTING — strictly typed (extended below)
  nextSteps?: NextStep[];      // NEW
}

// Extend ErrorContext (don't replace) with wireless-specific fields.
interface ErrorContext {
  command?: string;
  exitCode?: number;
  stderr?: string;
  checkedPaths?: string[];
  buildResult?: Record<string, unknown>;
  // NEW (wireless ADB):
  address?: string;
  attempts?: number;
  deviceId?: string;
  discoveredCandidates?: { address: string; deviceLabel?: string }[];
}

// And the wire shape returned to the agent:
interface ToolError {
  error: ErrorCode;
  message: string;
  suggestion?: string;
  details?: ErrorContext;
  nextSteps?: NextStep[];      // NEW — populated by toToolError()
}
```

**Convention for `required`:** mark `required: true` only when the underlying error signal is unambiguous — a documented, exact-match substring with one possible cause (e.g., literal `"failed to authenticate"` → pair is required). Wrong-port, refused, timeout, and most network failures are **ambiguous** (stale port, sleeping device, firewall, different SSID) and use `required: false`. The string-matching catalogue lives in one place in the adapter and is documented inline. Adding new classifications requires evidence (a real adb output captured during testing).

**Convention for `args`:** when the agent needs information from the user, place a placeholder string starting with `"<ask user — "`, e.g. `"<ask user — pair address shown on the phone's Wireless debugging screen>"`. The agent forwards that prompt to its caller.

**Relationship between `suggestion` and `nextSteps`.** Both convey "what to do next" and may both be populated on a wireless error. Convention:
- `suggestion` is a **single human-readable line**, ≤120 chars, safe for any client to render verbatim — including small models that don't parse `nextSteps`.
- `nextSteps` is the **structured form** of the same intent — what the orchestrator should programmatically follow.
- They **must agree**. If `nextSteps[0]` says "pair this device first," `suggestion` should say roughly the same thing, not contradict it. The Stage 1 error builders are the single place that constructs both, so there is one writer per error code; a unit test asserts that for every wireless error code, a populated `nextSteps` implies a populated `suggestion` and the suggestion mentions the same primary action.
- A client that consumes `nextSteps` should ignore `suggestion` for redundancy purposes; `suggestion` exists for clients that don't.

**Pairing-code redaction.** `pairingCode` is a 6-digit secret with a ~30s lifetime. Adb sometimes echoes it back in stderr.
- Never put `pairingCode` in `error.context` (including `stderr` — strip it before storing).
- Never log `pairingCode` from `process-runner.ts`. The argv array passed to adb must be redacted before any log statement: replace the value following the `pair` subcommand's address with `<redacted>`.
- Never include `pairingCode` in Stage 5 events.
- Tests assert that serialized errors and any captured logs do not contain the literal pairing code.

**Failure shapes (concrete examples):**

```ts
// connect → auth rejected
{
  error: "CONNECTION_FAILED",
  message: "Could not establish a session with 192.168.1.10:5555",
  details: { address: "192.168.1.10:5555", attempts: 2 },
  nextSteps: [{
    action: "Pair this device first",
    required: true,
    operation: "adb-device",
    args: {
      operation: "pair",
      address: "<ask user — pair address shown on the phone's Wireless debugging screen>",
      pairingCode: "<ask user — 6-digit pairing code>",
      connectPort: "<ask user — connect port shown on the same screen>",
    },
    reason: "the device rejected the connection because this host is not yet trusted",
  }],
}

// connect (no address) → multiple candidates discovered
{
  error: "MULTIPLE_WIRELESS_CANDIDATES",
  message: "Found 2 wireless devices on the network",
  details: {
    discoveredCandidates: [
      { address: "192.168.1.10:5555", deviceLabel: "Pixel 7" },
      { address: "192.168.1.42:5555", deviceLabel: "OnePlus 11" },
    ],
  },
  nextSteps: [
    {
      action: "Connect to Pixel 7",
      required: false,
      operation: "adb-device",
      args: { operation: "connect", address: "192.168.1.10:5555" },
      reason: "discovered candidate",
    },
    {
      action: "Connect to OnePlus 11",
      required: false,
      operation: "adb-device",
      args: { operation: "connect", address: "192.168.1.42:5555" },
      reason: "discovered candidate",
    },
  ],
}

// pair succeeded but connect failed — distinct code so agent doesn't re-pair
{
  error: "PAIR_OK_CONNECT_FAILED",
  message: "Paired with 192.168.1.10 but could not establish a connection",
  details: { address: "192.168.1.10:5555", attempts: 2 },  // record the connect address that was tried
  nextSteps: [{
    action: "Connect to the paired device",
    required: true,
    operation: "adb-device",
    args: { operation: "connect", address: "192.168.1.10:5555" },
    reason: "pairing succeeded; the connection step needs to be retried with the connect address",
  }],
}
```

## Files to modify

### `src/tools/adb-device.ts`
- Extend `adbDeviceInputSchema`: enum gains `"connect" | "disconnect" | "pair"`. Add optional fields with **real validation** (the test list asserts these rejection paths):
  - `address: z.string().regex(/^[\w.-]+:\d+$/, "expected host:port")` — rejects bare hosts or missing port.
  - `pairingCode: z.string().regex(/^\d{6}$/, "expected six digits")` — rejects non-digit strings of length 6 (e.g., `abcdef`).
  - `connectPort: numberInput({ min: 1, max: 65535 }).pipe(z.number().int())` — uses the repo's `numberInput` from `src/schemas/inputs.ts` to handle MCP clients that stringify numbers.
- Add `handleConnect`, `handlePair`, `handleDisconnect`. Wire into the `operations` map.
- Rewrite the tool top-level `description` to teach the workflow (see "Tool description" below).
- After successful `connect`/`pair`, set the wireless device as current. See "Current-device semantics" below — auto-select is *not* unconditional.

### `src/types/schemas/adb-device-output.ts`
- Add `transport: z.enum(["usb", "wireless"]).optional()` to `DeviceSchema`. (Note: `transport` is for *physical* devices only. Emulators are still distinguished by `type: "emulator"`.)
- Add three new output schemas:
  - `AdbDevicePairOutput` — `{ device, currentDevice, previousDevice: Device | null }`.
  - `AdbDeviceConnectOutput` — `{ device, currentDevice, previousDevice: Device | null }`.
  - `AdbDeviceDisconnectOutput` — `{ disconnected: string[], currentDevice }`.
- Add the three new schemas to the `AdbDeviceOutput` union.
- Export inferred types alongside existing ones.

### `src/adapters/adb.ts`
Add internal helpers on `AdbAdapter`. These are not new MCP tools — they're called by the new operation handlers:
- `connect(target: string): Promise<{ message: string }>`
- `disconnect(target?: string): Promise<{ message: string }>`
- `pair(target: string, code: string): Promise<{ message: string }>`
- `mdnsServices(): Promise<string>` (raw stdout; parsed by `parseMdnsServices`)
- `verifyDevice(deviceId: string, timeoutMs: number): Promise<VerifyResult>` where:

  ```ts
  type VerifyResult =
    | { ok: true;  serial: string; model: string; fingerprint: string }
    | { ok: false; reason: "unauthorized" | "offline" | "timeout" | "unknown"; stderr?: string };
  ```

  Runs **two sequential** `adb -s <id> shell getprop ro.serialno` and `adb -s <id> shell getprop ro.product.model` calls. **Do not use `&&` to chain them in a single shell call**: `ProcessRunner.validateShellPayload` (`src/services/process-runner.ts:155`) rejects `&`, `;`, `|`, etc. before the command runs. Two separate adb invocations is the only safe form. Both calls share the same `timeoutMs` budget (split or sequential — implementation choice).

  **Discriminated union, no throw.** `verifyDevice` returns the result; classification of the `reason` string into `"unauthorized" | "offline" | "timeout" | "unknown"` happens here in one place by matching documented adb stderr substrings. Callers (the operation handlers in `adb-device.ts`, Stage 2's pre-flight, Stage 4's supervisor) consume the discriminated union: `result.ok` narrows to the success branch (compiler enforces all three fields present) or the failure branch (compiler enforces `reason`). Adding a new failure mode is a single enum addition with one catalog entry.

  **Tool handlers translate failure to `ReplicantError`.** When `verifyDevice` returns `{ ok: false, reason: "unauthorized" }`, the calling handler builds `ReplicantError(CONNECTION_FAILED, ...)` with `nextSteps[0].required = true` and `args.operation = "pair"` — auth failure is unambiguous, only `pair` fixes it. `"offline" | "timeout" | "unknown"` map to `nextSteps` with `required: false` because the underlying cause is ambiguous (sleeping device, firewall, stale port, network change).

  **`verifyDevice` is the only producer of fingerprints** — every other component receives them already computed and never re-derives them. This is the same primitive used by Stage 2 pre-flight, Stage 3 cache writes, and Stage 4 supervisor identity confirmation.

Each maps non-zero exits and known stderr substrings to `ReplicantError` with new codes (`CONNECTION_FAILED`, `PAIRING_FAILED`, `PAIR_OK_CONNECT_FAILED`, `MULTIPLE_WIRELESS_CANDIDATES`) and populated `nextSteps`.

### `src/services/device-state.ts`
- Add `clearAndAutoSelect(devices: Device[]): boolean` helper, used by `disconnect`. Implementation: clear current device, then `autoSelectIfSingle(devices)` (existing helper returns false if a current device is already set, which is why a separate clear step is needed first).
- **Change `setCurrentDevice` signature from `(device: Device): void` to `(device: Device): Device | null`** — return the previous device (or `null` if none). The new `connect`/`pair` handlers use the return value to populate `previousDevice` in their response. This is mandatory, not optional: the output schema for `AdbDeviceConnectOutput` and `AdbDevicePairOutput` declares `previousDevice: Device | null` (always present, possibly null).

### `src/services/process-runner.ts`
- Add argv redaction: when logging an `adb pair <addr> <code>` invocation, replace `<code>` with `<redacted>` before any log/event emission. Add a unit test that asserts the literal pairing code never appears in captured log output.

### `src/services/identity.ts` (NEW)

A single-function module: `computeFingerprint(serial: string, model: string): string` returning `sha256(serial + "\x00" + model)` as lowercase hex. Used by `verifyDevice` and nowhere else (other components receive the already-computed string). The null-byte separator prevents `("AB", "C")` colliding with `("A", "BC")`. Pin the format with a unit test (`tests/services/identity.test.ts`) that asserts a known input produces a known hash — the cache, lock keys, and event log all depend on this format being stable across releases.

### `src/services/locks.ts` (NEW) + `src/server.ts`
- A single-lane per-key async lock primitive used by `connect`, `disconnect`, `pair`, and the verify/reset sequence. Stage 2's adapter-level retry and Stage 4's supervisor will reuse this. Introducing the lock in Stage 1 prevents the same wireless transport being torn down concurrently by two tool calls before any supervisor exists.
- **Wired through `ServerContext`** — not a module-level singleton (which would violate `CLAUDE.md`'s no module-level mutable state rule). Add `deviceLocks: DeviceLocks` to the `ServerContext` interface (`src/server.ts:44`) and instantiate it in `createServerContext()` (`src/server.ts:57`). Tools and adapters access it via the context they're already passed.

**Lock key strategy.** A pair address (`<ip>:<pair-port>`) and connect address (`<ip>:<connect-port>`) refer to the *same physical device* but on different ports — keying on the full `host:port` would mis-serialize them. Use:
- **Host-level key** (just the IP, e.g. `192.168.1.10`) for `pair`, `connect`, and any verify/reset before identity is confirmed.
- **Fingerprint-level key** (the canonical fingerprint string — see *fingerprint* in `CONTEXT.md`) once `verifyDevice` has returned one. Stage 3's cache-driven flows and Stage 4's supervisor key on fingerprint. The lock key is the fingerprint string verbatim — no further hashing, no `serial+model` concatenation at the call site.

**Single-direction alias map (`hostToFingerprint`).** The lock manager maintains one map populated by verified connects. Every acquire normalizes its argument to a single canonical key before locking, and **re-checks after acquire** to handle in-flight alias publication:
- `acquireHost(host)`: read `key = hostToFingerprint[host] ?? host`; await `locks.get(key).acquire()`; re-read `key' = hostToFingerprint[host] ?? host`; if `key' !== key`, release and loop. The re-check is the load-bearing piece — without it, callers queued on `lock(host)` (or `lock(FP_old)`) before a `transferAlias` would wake up holding the wrong key and race the handler's post-verify tail running under `lock(fingerprint)`. In TS's single-threaded event loop, the snapshot-then-await-then-re-check sequence is naturally serialized: the alias map cannot change between any two synchronous statements.
- `acquireFingerprint(fp)` locks directly on `fp` and likewise re-checks: if a concurrent `transferAlias` rebound something away from `fp` while this caller was queued, the caller releases and re-acquires (or, in the unbind-then-rebind sweep, fails fast — `disconnect`'s `unbindAlias` plus a fresh connect can re-key `fp`'s neighbours). No reverse lookup needed: hosts bound to `fp` always route to `fp` via the rule above, so the supervisor holding `fp` blocks any foreground host-keyed disconnect for the bound host.
- **Alias publication is a lock transfer (with a no-op fast path).** After `verifyDevice` confirms identity, the connect/pair/supervisor handler is in one of three cases:
  - **First bind** (host previously unbound): handler holds `lock(host)`. Verify returns `fp`. Need to publish the alias and switch to `lock(fp)`.
  - **Replacement** (host previously bound to `FP_old`, different physical device showed up at the same IP): handler holds `lock(FP_old)` (routed through the alias map). Verify returns `FP_new ≠ FP_old`. Need to rebind and switch to `lock(FP_new)`.
  - **Already bound** (host previously bound to `fp` and the same `fp` returned — the supervisor's normal mDNS rediscovery of a cached host on a long-lived server, or a foreground reconnect of an already-aliased host): handler already holds `lock(fp)` (routed via the alias map); the alias map already has `hostToFingerprint[host] === fp`. Nothing to publish, nothing to switch.

  In the first two cases the handler must end up holding `lock(fingerprint)` so future `acquireHost(host)` and `acquireFingerprint(fingerprint)` callers serialize on the same lock as the in-flight operation's remaining post-verify work (cache write, current-device update, supervised-set add). **Naively publishing the alias while still holding only the prior lock is unsafe** — once the alias is published, future `acquireHost(host)` routes to `lock(fingerprint)`, which the handler does NOT hold; a concurrent foreground `disconnect` or supervisor reconnect could acquire `lock(fingerprint)` immediately and race the handler's tail.

  The safe sequence for first-bind and replacement is: while still holding the current lock, acquire `lock(fingerprint)`; then update the alias map (`hostToFingerprint[host] = fingerprint`); then release the prior lock. Held-lock overlap during the map mutation, plus the **re-check on acquire** described above, together close the queued-waiter race: callers queued on the prior lock wake up after `transferAlias` releases it, observe the changed alias on re-check, release the prior lock, and re-queue on `lock(fingerprint)` — which the handler still holds for its tail work. **The already-bound case takes a no-op fast path**: `transferAlias` detects `hostToFingerprint[host] === fingerprint` on entry and returns the caller's `currentRelease` unchanged — re-acquiring `lock(fingerprint)` while already holding it would self-deadlock, and there is no alias change to publish. The detection is sound because the alias-map invariant means that if `hostToFingerprint[host] === fingerprint`, any caller whose `currentRelease` came from `acquireHost(host)` or `acquireFingerprint(fingerprint)` must hold `lock(fingerprint)` (acquireHost routes there; acquireFingerprint locks it directly). Expose this as a single primitive on `DeviceLocks`:

  ```ts
  // No-op fast path: if hostToFingerprint[host] === fingerprint, return currentRelease unchanged.
  // Otherwise atomically: acquire lock(fingerprint), set hostToFingerprint[host] = fingerprint,
  // release the caller's prior lock. Returns the lock(fingerprint) release fn.
  transferAlias(currentRelease: () => void, host: string, fingerprint: string): Promise<() => void>;
  ```

  Handler call shape: `release = await locks.transferAlias(release, host, fp);` — the handler's local `release` variable now refers to `lock(fingerprint)` and continues to serialize the rest of the operation. The internal `bindAlias` is not exposed; alias-map mutation only happens inside `transferAlias` so it cannot be called without the corresponding lock held.
- `unbindAlias(fingerprint)` is called by `disconnect` after teardown; it removes any `host` entries whose value is `fingerprint`. O(n) over the alias map (small — bounded by live connects), no second map needed.
- **Implementation note (multi-acquire deadlock).** `transferAlias` acquires a second lock while holding the prior one. Two concurrent transfers that cross-target each other's keys (e.g., devices swapping IPs and both being re-verified at the same instant) can deadlock under naive nested acquisition. This is a standard multi-lock concern; the implementation should choose one of the established remedies (deterministic key-ordered acquisition, try-acquire-with-timeout + retry, or single global serializing mutex around the transfer fast-path). The choice is implementation detail and does not affect this plan's API contract; flagged here so the implementer doesn't have to re-derive the concern.
- Stage 3's cache and supervised-set both use fingerprint keys, but the lock manager is the only component that needs to translate between host and fingerprint at lock time. Cache lookups by host (e.g., during a no-args connect) consult the cache directly, not the alias map.

```ts
// Sketch — actual API designed in implementation
export class DeviceLocks {
  acquireHost(host: string): Promise<() => void>;            // routes to fingerprint lock if alias bound; re-checks after acquire
  acquireFingerprint(fingerprint: string): Promise<() => void>; // re-checks after acquire
  // tryAcquire variants for Stage 4 supervisor's defer-on-contention behaviour.
  // tryAcquireHost is needed by the supervisor's mDNS scan, where identity isn't yet confirmed.
  tryAcquireHost(host: string, timeoutMs?: number): Promise<(() => void) | null>;
  tryAcquireFingerprint(fingerprint: string, timeoutMs?: number): Promise<(() => void) | null>;
  // The only way to publish or rebind an alias. Held-lock overlap guarantees no concurrent
  // caller observes the alias change without serializing on the new lock. No-op fast path
  // when alias already maps host → fingerprint (caller already holds lock(fingerprint)).
  // Internal bindAlias is not exported; callers cannot mutate the map without it.
  transferAlias(currentRelease: () => void, host: string, fingerprint: string): Promise<() => void>;
  // Called by disconnect after teardown; removes any host entries pointing at this fingerprint.
  unbindAlias(fingerprint: string): void;
}
```

### `src/parsers/adb-output.ts`
- In `parseDeviceList`: detect `host:port` IDs (regex `^[\w.-]+:\d+$`) and set `transport: "wireless"`. Existing `emulator-*` check first; for emulators, leave `transport` undefined (transport applies to physical devices only).
- Add `parseMdnsServices(stdout: string)` returning structured records. `.tool-versions` only pins `bd` and `gh`, not `adb` — so capture fixtures locally, run `adb version` to get the platform-tools build, and write a header comment in each fixture file with the captured version. Add a `tests/fixtures/wireless-adb/README.md` documenting how to regenerate fixtures and which version of platform-tools the current set was captured against. Capture both **connect-mode** and **pairing-mode** mDNS service outputs (`_adb-tls-connect._tcp` vs. `_adb-tls-pairing._tcp`) so the parser doesn't accidentally treat pairing ports as connect candidates. CI will not provide multiple adb versions; "robustness across versions" is a maintenance task, not a Stage 1 requirement.

### `src/types/device.ts`
Add `transport?: "usb" | "wireless"`. Non-breaking. **Scope:** `transport` is a property of *physical* devices only. Emulators continue to be identified by `type: "emulator"`. Stage 2's pre-flight verify gates on `transport === "wireless"`, which is the only place this field is consulted.

### `src/types/errors.ts`
- Add `NextStep` interface.
- Add `nextSteps?: NextStep[]` to both `ReplicantError` and `ToolError`.
- Update `toJSON()` and `toToolError()` to include `nextSteps`.
- Extend `ErrorContext` with `address?`, `attempts?`, `deviceId?`, `discoveredCandidates?` (see "Error envelope" above).
- Add new `ErrorCode` values: `CONNECTION_FAILED`, `PAIRING_FAILED`, `PAIR_OK_CONNECT_FAILED`, `MULTIPLE_WIRELESS_CANDIDATES`. (Distinct from existing `MULTIPLE_DEVICES`, which signals selection ambiguity among already-connected devices.)

### `scripts/generate-contract.ts` and `docs/contracts/*`
- The current generator (`scripts/generate-contract.ts:100,114`) emits only `inputSchema` + `outputSchemas` per tool. **It has no error model.** Without changes, runtime can populate `nextSteps` correctly while the *published* contract claims it doesn't exist.
- Add a new top-level field `errorEnvelope: { schema: <JSON Schema for ToolError including nextSteps>, errorCodes: ErrorCode[] }` emitted alongside the per-tool schemas. Build a Zod schema for `ToolError` (including `nextSteps`, `details: ErrorContext`, `error: ErrorCode` enum) in `src/types/errors.ts` and feed it through `zodToJson()`.
- Regenerate `docs/contracts/replicant-mcp.contract.json`. Verify CI's contract-drift check still passes.

### `src/cli/adb.ts`
Add three subcommands so the live-smoke verification in this stage actually has a vehicle: `pair <pairAddress> <code> [--connect-port <n>]`, `connect [address]`, `disconnect [address]`. Each calls the new `AdbAdapter` helpers directly (no MCP layer) and prints success/error in the existing CLI style. These are convenience for human verification and never used by the MCP tool path.

The unified entrypoint (DECISIONS 2026-02-11) routes any `argv.length > 2` invocation to the CLI, so `npx replicant-mcp adb pair ...` already reaches `src/cli/adb.ts` without any new bin entry. Live-smoke verification commands in this plan use that form.

### Tool description (verbatim sketch)

> Manage Android devices, including wireless debugging. Operations: `list`, `select`, `wait`, `properties`, `health-check`, `pair`, `connect`, `disconnect`.
>
> **Wireless devices.** A phone over Wi-Fi works the same as a USB device once registered. To register: ask the user to open Developer options → Wireless debugging on their phone. They'll see an address (like `192.168.1.10:41234`), a 6-digit pairing code, and a separate connect port. Pass those to `pair`. After that, `connect` reconnects without a code.
>
> **Failure responses include `nextSteps`.** Each step has `{ action, required, operation, args, reason }`. If a step has `required: true`, do it; if `false`, treat as a suggestion. When `args` contains a string starting with `"<ask user — "`, forward that prompt to the user.

## Existing utilities to reuse

- `ProcessRunner.runAdb` (`src/services/process-runner.ts`) — feed it new arg arrays.
- `EnvironmentService.getAdbPath` — already resolves the binary; no new requirement.
- `DeviceStateManager.setCurrentDevice` (`src/services/device-state.ts`) — call after `connect`/`pair` to make the new device current.
- `ReplicantError` + `ErrorCode` — extend rather than replace.

## Tests — `tests/tools/adb-device.test.ts` (NEW)

Mirror the mocking style in `tests/tools/adb-shell.test.ts`. Cover at least:
- `pair` happy path: pair + auto-connect + verify, returns `{ device, currentDevice }`.
- `pair` with rejected code → `PAIRING_FAILED`, `nextSteps[0].required === true`, `args` contains a fresh `pairingCode` placeholder.
- `pair` succeeds but connect fails → distinct `PAIR_OK_CONNECT_FAILED` code, `nextSteps[0].operation === "adb-device"` with `operation: "connect"`.
- `connect` happy path with explicit `address` → verifies and auto-selects.
- `connect` with stale target triggering recovery chain → succeeds without surfacing recovery details to the agent.
- `connect` no-args with one wireless candidate → connects.
- `connect` no-args with multiple candidates → `MULTIPLE_WIRELESS_CANDIDATES`, `nextSteps` contains ready-to-call entries for each (all `required: false`).
- `connect` with auth-failure stderr → `nextSteps[0].required === true`, points to `pair`.
- `disconnect` with address; without address (disconnects all wireless); idempotent re-call.
- `disconnect` clears current and auto-selects when one device remains online (covers the `clearAndAutoSelect` path).
- `connect` while another device (e.g. emulator) is current → response includes `previousDevice`.
- `parseDeviceList` recognises `192.168.1.10:5555  device` and sets `transport: "wireless"`; emulator IDs do not get a `transport` field.
- Schema validation: `pairingCode` of wrong length, `connectPort` out of `[1, 65535]`, `address` missing port — all rejected with `INPUT_VALIDATION_FAILED`.
- Pairing-code redaction: a `pair` call where adb echoes the code back in stderr produces a `ReplicantError` whose serialized form (via `toToolError()` and `JSON.stringify`) does **not** contain the literal pairing code anywhere. A separate test on `process-runner` asserts the code is redacted from any captured log.
- Wire-shape: a `ReplicantError` with `nextSteps` populated, run through `toToolError()`, retains `nextSteps` (regression test for the P0 plumbing change).

Plus parser tests in `tests/parsers/adb-output.test.ts` (extend or create) — mDNS output fixtures captured from the pinned platform-tools version, committed under `tests/fixtures/`.

Run `npm run test:coverage` to confirm thresholds (per `vitest.config.ts`) still pass.

## Verification

1. **Unit tests:** `npm test`. All existing tests still pass; new tests pass.
2. **Coverage:** `npm run test:coverage` meets thresholds.
3. **Build / lint:** `npm run build` and `npm run lint` clean.
4. **Live smoke (real Android device, same Wi-Fi).** Done by a human via the CLI in `src/cli/adb.ts` — verifies the MCP itself, not the agent flow:
   - On phone: Settings → Developer options → Wireless debugging → ON. First time: "Pair device with pairing code" → note all four values (IP, pair port, code, connect port).
   - Call `adb-device pair address=<ip>:<pair-port> pairingCode=<code> connectPort=<connect-port>` → response includes `device` with `transport: "wireless"` and `currentDevice` set.
   - Call `adb-shell command="getprop ro.product.model"` → returns the model. **This is the proof wireless works end-to-end.**
   - Call `adb-device connect address=<ip>:<connect-port>` (idempotent re-call) → succeeds.
   - Call `adb-device connect` (no args) → finds and connects to the same device.
   - Call `adb-device disconnect` → device removed.
5. **Failure-shape spot check.**
   - **Auth-rejected** (e.g., point at a host that hasn't been paired): response carries a non-empty `nextSteps` whose first entry has `required: true`, `operation: "adb-device"`, and `args.operation: "pair"`. This is the unambiguous-cause path.
   - **Wrong port** (transient/ambiguous): response carries `nextSteps` entries with `required: false` (suggestions only). Wrong-port failures are ambiguous (sleeping device, firewall, stale port, network change) and must not assert a single recovery.
6. **Vocabulary audit.** Grep `nextSteps` reasons and error messages for `"adb"` — should appear nowhere except the top of the tool description.
7. **Wire-shape audit.** Round-trip a synthetic `ReplicantError` with `nextSteps` through `toToolError()` and `JSON.stringify`; assert `nextSteps` is preserved end-to-end.

## Privacy

Per `CLAUDE.md`'s privacy policy guidance: wireless ADB introduces no new external network calls (still talks to the local `adb` server only), no persistence in Stage 1, and no new dependencies. mDNS scanning is local-network only, identical in scope to what `adb` itself does. **Expected outcome: `PRIVACY.md` adds a note that `pairingCode` is treated as a transient secret (never logged, never persisted, never returned in error context). No other changes.** Confirm during PR. Stages 3 (persistence) and 5 (events) will require their own privacy review.

## Decisions to record in `DECISIONS.md`

- Wireless ADB is exposed as operations on `adb-device`, not a separate tool.
- Network scanning (mDNS) is an internal recovery primitive, not an agent-facing operation.
- Server-side fallback is mandatory and not configurable from the MCP surface; future supervisors will use a non-MCP internal API.
- Errors carry structured `nextSteps` to eliminate agent reasoning on failure paths. `nextSteps` flows through `ToolError`/`toToolError()` so it actually reaches the agent over the wire.
- `transport` is a property of physical devices (`"usb" | "wireless"`); emulators continue to be identified by `Device.type`.
- A per-device async lock primitive (`src/services/locks.ts`) is introduced in Stage 1 because mid-flight teardown (Stage 1 reset, Stage 2 retry, Stage 4 supervisor) all share it.
- `verifyDevice` is a single primitive that returns `{ ok, serial, model, fingerprint }` so verify and Stage 3+4 fingerprint use share one shell call.
- The canonical device fingerprint is `sha256(serial + "\x00" + model)` rendered as lowercase hex, computed in `src/services/identity.ts` and pinned by a format test. Defined in `CONTEXT.md`. Used by locks (Stage 1), endpoint cache (Stage 3), supervised set (Stages 3-4), and event log (Stage 5) without re-derivation.
- `ToolError.suggestion` (one human-readable line) and `ToolError.nextSteps` (structured) are dual channels for the same intent. They must agree; a unit test enforces parity for every wireless error code. Existing non-wireless errors keep `suggestion`-only; nothing is migrated.
- `DeviceLocks` uses a **single-direction** alias map (`hostToFingerprint`); the reverse map proposed in earlier drafts is unnecessary because `acquireHost` always routes to fingerprint when bound, so a supervisor holding the fingerprint already blocks any host-keyed acquire for that device.
- `mdnsServiceName` is stored in the cache as a cheap match hint, never as an authoritative identity claim. Every match is confirmed by `verifyDevice`'s returned fingerprint; on mismatch the cache row is treated as a miss.
- The supervised set is persisted from Stage 3 (file alongside the endpoint cache, same data dir, `0600`); Stage 4's supervisor reads it but does not own it. The cache (how to reach a device) and the supervised set (whether to keep trying) are co-mutated by `connect`/`pair`/`disconnect` but persisted as separate files.
- Pairing codes are treated as transient secrets and redacted in logs and error context.
- Roadmap for Stages 2-5 lives at `.planning/wireless-adb/`.

## Out of scope (deferred to later stages)

- Pre-flight health check before tool calls; reconnect on tool-call failures other than `connect`/`pair`. → Stage 2.
- Persisting last-known endpoints across server restarts. → Stage 3.
- A long-running supervisor that detects and recovers from connection loss without a triggering tool call. → Stage 4.
- An accessible event log of connect/disconnect events. → Stage 5.
- Replacing the `adb` CLI with a native protocol implementation. (No stage planned.)
