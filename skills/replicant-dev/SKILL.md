# Android Development Skill

Automate Android development tasks: build APKs, run tests, manage emulators,
install apps, read logs, and interact with UI elements.

## When to Use

Use this skill when the user asks to:
- Build, compile, or assemble an Android app
- Run unit tests or instrumented tests
- Start, stop, or manage Android emulators
- Install, launch, or uninstall apps on a device
- Read logcat logs or debug crashes
- Tap buttons, enter text, or interact with app UI
- Take screenshots or inspect the accessibility tree

## Prerequisites

- **macOS or Linux** (Windows support coming)
- Node.js 18+
- Android SDK with `adb` and `emulator` in PATH
- An Android project with `gradlew` (for build operations)

## Setup

Run once after cloning:
```bash
cd /path/to/replicant-mcp
npm install
npm run install-skill
```

## Available Scripts

| Script | Purpose |
|--------|---------|
| `build-apk.sh` | Build debug or release APK |
| `run-tests.sh` | Run unit or instrumented tests |
| `list-modules.sh` | List Gradle modules |
| `build-details.sh` | Get full build/test output |
| `list-emulators.sh` | Show available AVDs |
| `start-emulator.sh` | Boot an emulator |
| `stop-emulator.sh` | Shut down an emulator |
| `snapshot.sh` | Manage emulator snapshots |
| `list-devices.sh` | Show connected devices |
| `select-device.sh` | Set active device |
| `install-app.sh` | Install APK to device |
| `launch-app.sh` | Start an app |
| `stop-app.sh` | Force stop an app |
| `uninstall-app.sh` | Remove app from device |
| `clear-data.sh` | Clear app data |
| `read-logs.sh` | Read filtered logcat |
| `dump-ui.sh` | Get accessibility tree |
| `find-element.sh` | Find UI elements |
| `tap-element.sh` | Tap a UI element |
| `input-text.sh` | Type text |
| `screenshot.sh` | Capture screen |
| `shell-cmd.sh` | Run adb shell command |
| `cache-stats.sh` | View cache statistics |
