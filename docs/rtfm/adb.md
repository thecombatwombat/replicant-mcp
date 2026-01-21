# ADB Tools

## adb-device

Manage device connections.

**Operations:**
- `list` - List connected devices
- `select` - Select active device
- `wait` - Wait for device to connect
- `properties` - Get device properties

## adb-app

Manage applications.

**Operations:**
- `install` - Install APK
- `uninstall` - Uninstall package
- `launch` - Launch app
- `stop` - Force stop app
- `clear-data` - Clear app data

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
- `timeout`: Max execution time (default: 30s, max: 120s)

**Blocked commands:** rm -rf /, reboot, shutdown, su, sudo
