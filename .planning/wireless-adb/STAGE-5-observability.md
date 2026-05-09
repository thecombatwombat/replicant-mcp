# Wireless ADB — Stage 5: Observability

## Goal

Make wireless ADB diagnosable from inside the agent's own loop. When a connection has been flapping for an hour, the agent (or its caller) can ask the MCP server "what happened?" and get a structured answer.

## What it adds

- **In-server event log** of connect / disconnect / verify-fail / supervisor-reconnect events:
  - Each event: `{ timestamp, event, deviceFingerprint?, address?, reason?, recoveryApplied?, durationMs }`.
  - Bounded ring buffer (e.g., last 500 events, configurable). No on-disk persistence in Stage 5 — that can come later if useful.
  - **Event coalescing.** Repeated events of the same coalescing key within a short window (e.g., 10 seconds) collapse into one entry with a `count` field, so a flapping device cannot fill the buffer in minutes. The coalescing key is `(event, identity, reason)` where `identity` is `deviceFingerprint` if known, otherwise `address`. Including `reason` (e.g., `"device offline"`, `"connection refused"`) prevents collapsing genuinely different failures into one bucket. The fallback to `address` matters in early-stage incremental Stage 1 deployments where fingerprint may not yet be populated; without it, two unrelated devices with no fingerprint would appear as one. Backoff-step events from the supervisor are exempt — those are inherently rate-limited by the backoff itself.
  - **Pairing-code redaction** is enforced: events never carry `pairingCode` or any field whose value matches a 6-digit numeric pattern in pairing context. (Reuses the redaction primitive defined in Stage 1.)
- **New operation `adb-device events`** returning the recent events, optionally filtered by device fingerprint or time window.
- **Recovery success path captured here, not in agent responses.** Stage 1 deliberately hid recovery details from agent-facing success responses for cognitive simplicity. Stage 5 puts that data where it belongs: a separate channel an interested caller can query.
- **Supervisor (Stage 4) writes to the same log.** Background reconnect attempts, backoff steps, and final give-ups are all events.

## Dependencies

- Can be built incrementally. A minimum-viable version (just `connect`/`disconnect` events) can land alongside Stage 1.
- The full feature depends on Stage 4 to capture supervisor events.

## Key design notes

- **Read-only operation.** `events` doesn't mutate state. It's idempotent and cheap to call.
- **Structured, not free-text.** Events have typed fields so an agent can filter or count without parsing prose. The `event` field is an enum (`"connect-attempt"`, `"connect-success"`, `"verify-failure"`, `"reset-applied"`, `"supervisor-reconnect"`, etc.).
- **Privacy.** Event log entries reference device fingerprints and addresses — data already exposed by `list` and `properties`. The new surface is a *new retention window* (the AI can query history it never saw before), so `PRIVACY.md` must be updated to document: in-memory only (no disk), bounded by ring-buffer size, cleared on server restart, redacted of pairing codes. No new external egress.
- **Telemetry vs. logs.** This is structured *observability for the agent*, not a replacement for server logs. Existing server logging continues unchanged.
- **No long-term storage.** If an operator wants persistent history, they can poll `events` periodically and store externally. Stage 5 stays simple.

## Out of scope

- On-disk event persistence.
- Push notifications when an event matches a pattern.
- Analytics or aggregation operations (`events --since=1h --count-by=event`). Could be added later; not load-bearing.
