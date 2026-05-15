# ADB Tools

## adb-device

Manage device connections.

**Operations:**
- `list` - List connected devices
- `select` - Select active device
- `wait` - Wait for device to connect
- `properties` - Get device properties
- `health-check` - Validate Android SDK/adb setup and device connectivity

## adb-app

Manage applications.

**Operations:**
- `install` - Install APK
- `uninstall` - Uninstall package
- `launch` - Launch app
- `stop` - Force stop app
- `clear-data` - Clear app data
- `list` - List installed packages (paginated)
- `start-intent` - Fire an `am start` with a typed intent (URL safe)

**List options:**
- `limit`: Max packages to return (default: 20, max: 100)
- `offset`: Skip first N packages (pagination)
- `filter`: Case-insensitive package-name substring filter

**Start-intent options (CU-2 / THE-106):**
- `action` (required): Intent action like `android.intent.action.VIEW`
- `data`: Intent data URI (URLs with `&` query params are SAFE — built as argv, not joined into a shell string)
- `packageName`: Limit the intent to a specific package
- `component`: Explicit component (`pkg/.Activity` or `pkg/pkg.Activity`)
- `extras`: String extras as `{ "key": "value" }`. Each pair becomes an `--es key value` arg.

Use this instead of `adb-shell command="am start ..."` whenever the data URI
contains `&` or `?`. The typed entrypoint validates each field (action regex,
length caps, null-byte rejection, key/component shape) before building argv —
no shell-payload guard interaction at the cost of less flexibility.

Example:
```json
{
  "operation": "start-intent",
  "action": "android.intent.action.VIEW",
  "data": "https://example.com/?foo=bar&baz=qux"
}
```

## adb-logcat

Read device logs.

**Structured mode:**
- `package`: Filter to app's PID
- `tags`: Array of log tags
- `level`: "verbose" | "debug" | "info" | "warn" | "error"

**Raw mode:**
- `rawFilter`: Full logcat filter string (e.g., "ActivityManager:I MyApp:D *:S")

**Common:**
- `lines`: Number of lines (default: 100)
- `since`: Time filter ("5m" or ISO timestamp)

## adb-shell

Execute shell commands with safety guards.

**Parameters:**
- `command` (required): Shell command
- `timeout`: Max execution time in milliseconds
- `maxChars`: Truncate stdout/stderr to at most this many characters
- `summaryOnly`: Return compact previews and counts (omit full stdout/stderr)
- `previewChars`: Preview length when `summaryOnly: true` (default: 200)

**Blocked commands:** rm -rf /, reboot, shutdown, su, sudo
