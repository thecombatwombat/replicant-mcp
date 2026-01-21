# Emulator Tools

## emulator-device

Manage Android emulators.

**Operations:**
- `list` - List available and running emulators
- `create` - Create new AVD
- `start` - Start emulator
- `kill` - Stop running emulator
- `wipe` - Reset emulator data
- `snapshot-save` - Save snapshot
- `snapshot-load` - Load snapshot
- `snapshot-list` - List snapshots
- `snapshot-delete` - Delete snapshot

**Parameters:**
- `operation` (required): Operation to perform
- `avdName`: AVD name (for create/start/wipe)
- `device`: Device profile (for create, e.g., "pixel_7")
- `systemImage`: System image (for create)
- `snapshotName`: Snapshot name (for snapshot operations)
