# CONTEXT — replicant-mcp domain language

Canonical names and definitions for terms that have caused ambiguity in design discussions. Implementation should use these names directly. Add a term here when a planning conversation has to settle what it means; do not pre-populate.

## Devices

### device
A target Android instance that replicant-mcp can drive. Always either an emulator or a physical phone. The agent talks to one device at a time (see *current device*).

### current device
The single device every tool operates against by default. Set by `adb-device select`, `connect`, or `pair`. Distinct from the broader set of "available devices" (everything `adb devices` returns). Codebase symbol: `DeviceStateManager.currentDevice`. *Active device* is a synonym used in early DECISIONS entries; prefer "current device" going forward.

### transport
For physical devices, how the device is reached: `usb` or `wireless`. Emulators have no transport (they are identified by `type: "emulator"`). Wireless-specific behaviour gates on `transport === "wireless"`.

### endpoint
A `host:port` pair used to reach a wireless device. Distinct from *fingerprint* — endpoints change (DHCP renewal, port reassignment, network switch); fingerprints do not. The endpoint cache maps fingerprint → last-known endpoint.

## Identity

### fingerprint
A stable, hashed identifier for a single physical device, computed as `sha256(serial + "\x00" + model)` rendered as lowercase hex. The null separator prevents `("AB", "C")` colliding with `("A", "BC")`.

Used wherever the same physical device must be recognised across reconnects, IP changes, or server restarts — lock keys, endpoint cache keys, event log entries.

The raw `serial` and `model` stay in memory for the active session only; persistent storage uses the fingerprint, not the raw values, so a leaked cache file does not expose device serials. Only ever produced by querying the device (see *verify*); never inferred from network metadata (mDNS service names, IPs).

### verify
A round-trip that confirms a device-shaped thing on the network is actually a usable Android device, by reading two `getprop` values (`ro.serialno`, `ro.product.model`). Returns enough to compute the fingerprint. Used as the post-connect validation step and as Stage 2's pre-flight liveness check.

## Wireless ADB lifecycle

### pair
First-time trust ceremony for a wireless device. Consumes a one-shot 6-digit code and a *pair address* shown on the phone's Wireless debugging screen. Required once per (host, device) pair. Distinct from *connect*: pairing alone does not give you a usable session — you must also connect to the device's *connect address*, which is a different port.

### connect
Establish (or re-establish) a session with an already-paired device using its *connect address*. Repeatable, idempotent.

### pairing code
A 6-digit secret with a ~30-second lifetime, displayed on the phone during pairing. Treated as a transient secret: never logged, never persisted, never returned in error context.

### supervised set
The collection of fingerprints the background supervisor (Stage 4) is allowed to reconnect on its own. Mutated only by user intent — `connect`/`pair` add; explicit `disconnect` removes. **Distinct from the endpoint cache**: the cache remembers how to reach a device if asked; the supervised set declares the user wants the server to keep trying. Without this separation, a `disconnect` would be silently undone by the supervisor.
