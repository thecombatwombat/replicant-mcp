# Wireless ADB — Stage 2: On-demand recovery

## Goal

Tool calls other than `connect`/`pair` survive transient wireless hiccups by recovering once before surfacing failure. The agent doesn't have to know that recovery happened.

## What it adds

- **Pre-flight check in `ensureDevice`** (`src/services/device-state.ts`): when the current device is wireless, run a fast `verifyDevice(deviceId, ~3s)` probe before dispatching the tool's actual work. If it fails, attempt the canonical adb reset sequence once (under the per-device lock from Stage 1), then re-verify. **Pre-flight is gated on a freshness TTL**: if `verifyDevice` succeeded within the last ~30 seconds for the same device, skip the probe. This keeps latency floor low on rapid sequences of tool calls (a common agent pattern) without sacrificing the recovery property.
- **One-shot reconnect on tool-call failure** — **only for verified-idempotent adapter methods**: `getDevices`, `getProperties`, `getPackages`, `logcat`, `pull`, `waitForDevice`. These can be re-executed safely after a transport blip. **Mutating methods do not retry**: `install`, `uninstall`, `launch`, `stop`, `clearData`. **`shell()` is excluded entirely from automatic retry** — see "Why `adb shell` is excluded" below. UI tools (`ui-action tap/input/scroll`) likewise do not retry — their first command may have reached the device before the transport failed; replaying would double-tap.

### Why `adb shell` is excluded

The `adb-shell` tool accepts an arbitrary command string with no read-only flag (`src/tools/adb-shell.ts:6`), and is annotated `destructive/openWorld/non-idempotent` (`src/tools/adb-shell.ts:63`). The adapter's `shell()` method has no metadata channel for retry safety. The string `pm clear com.example` and `pm list packages` look identical to the adapter — only the second is safe to retry.

Stage 2 therefore does **not** retry `shell()` calls. Two practical consequences:
1. Pre-flight verify still applies: if the wireless device is unreachable before the call, Stage 2 recovers transport health *before* dispatch (this doesn't replay the user's command — it just confirms the channel).
2. If the channel dies *during* a `shell()` call, the failure surfaces to the agent with `nextSteps` pointing at `connect`. The agent decides whether replaying is safe.

A future stage may add an explicit `readOnly: boolean` flag to the `adb-shell` input schema and the adapter's `shell()` signature, and only retry when set. That work is not in Stage 2.
- **`adb-device health-check` extended**: when there is a current wireless device, actively probe it (using the same `verifyDevice` primitive) and report freshness. Existing health-check semantics for env/server detection unchanged.

The classification of which adapter methods are "idempotent for retry" lives next to the methods themselves in `src/adapters/adb.ts` (e.g., a small registry or per-method flag) so that adding a new method forces an explicit decision about retry safety.

## Dependencies

- Stage 1's `verifyDevice` primitive on `AdbAdapter` (returns `{ ok, serial, model }` — same call serves Stage 2 verify and Stage 3 fingerprint collection).
- Stage 1's `transport` field on `Device` (used to gate this behaviour to wireless devices only — USB devices don't need it).
- Stage 1's per-device lock primitive (`src/services/locks.ts`). Pre-flight reset and adapter retry both acquire the lock so they cannot race a concurrent `connect`/`disconnect`.

## Key design notes

- **One retry, not a loop.** Looping recovery in a tool path can mask deeper failures and inflate latency. One retry handles transient blips; persistent failures fall through quickly. Total retry budget per wireless tool call: original attempt + reset (1) + retry (1) = at most 2 work attempts.
- **Pre-flight probe is gated on wireless and on freshness TTL.** USB devices don't pay the verify cost. A short TTL (~30s) on the last successful verify avoids ~3s pre-flight latency on every call in a tight agent loop.
- **Retry safety is per-method, opt-in.** Default for any new adapter method is "no retry" until proven idempotent. Mutating methods always fall through to the user with a `nextSteps` pointer to `connect`.
- **Recovery is silent on the success path.** The Stage 1 principle stands: agents don't see recovery work that succeeded. Stage 5 captures it for telemetry.
- **Failure surfaces with `nextSteps`** pointing at `connect` (or `pair` if auth-related), reusing the Stage 1 envelope.

## Tests

- Pre-flight: skipped when `verifyDevice` succeeded within TTL; runs when stale; runs reset+retry on stale failure.
- Idempotent adapter method (`getProperties`) survives one transient `device offline` and returns success without surfacing recovery.
- Mutating adapter method (`install`) does **not** retry on transient failure — surfaces error with `nextSteps` pointing at `connect`.
- `shell()` failure during execution does **not** retry — surfaces error directly. (Regression test for the explicit shell exclusion.)
- Lock contention: a concurrent `disconnect` call during pre-flight reset waits and observes consistent state.

## Out of scope (still deferred)

- Endpoint persistence across server restarts (Stage 3).
- Background watching (Stage 4).
