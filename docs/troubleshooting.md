# Troubleshooting

## "No device selected"

Run `adb-device` with `operation: "list"` to see available devices, then `operation: "select"` to choose one. If only one device is connected, it's auto-selected.

## "Gradle wrapper not found"

Make sure you're in an Android project directory that contains `gradlew`. The Gradle tools won't work from other locations. If you're running replicant-mcp as an MCP server (e.g., via Claude Desktop), set `REPLICANT_PROJECT_ROOT` to your project path or configure `build.projectRoot` in your config file. See [configuration.md](configuration.md) for details.

## "Command timed out"

Long-running operations (builds, tests) have a 5-minute default timeout. If your builds are slower, you may need to adjust the timeout in the adapter. To investigate what's taking so long, set `REPLICANT_LOG_LEVEL=debug` for verbose output showing each step's timing. See [configuration.md](configuration.md) for all logging options.

## Emulator won't start

Check that:
1. You have an AVD created (`avdmanager list avd`)
2. Virtualization is enabled (KVM on Linux, HAXM/Hypervisor.framework on macOS)
3. Enough disk space for the emulator (at least 8 GB free recommended)
4. No other emulator instance is already using the same AVD
5. Your system meets the RAM requirements (emulators typically need 2-4 GB)

If you're on macOS with Apple Silicon, make sure you're using an `arm64` system image, not an `x86_64` one. Run `replicant-mcp doctor` to check your emulator setup.

## "Android SDK not found" / "adb not found"

This means `ANDROID_HOME` is not set or `adb` is not in your PATH. Common SDK locations:

- **macOS**: `~/Library/Android/sdk`
- **Linux**: `~/Android/Sdk`
- **Windows**: `%LOCALAPPDATA%\Android\Sdk`

Set the environment variable and ensure platform-tools is in your PATH:

```bash
export ANDROID_HOME=~/Library/Android/sdk
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Run `replicant-mcp doctor` to diagnose all environment issues at once. It checks for Node.js, adb, emulator, avdmanager, and connected devices.

## "Build fails with dependency errors"

Common causes include missing SDK components or a mismatch between your project's `compileSdk` and installed SDK versions. Steps to diagnose:

1. Use `gradle-list` with `operation: "variants"` to check available build variants
2. Open Android Studio SDK Manager and verify the required API level is installed
3. Check that `compileSdk`, `minSdk`, and `targetSdk` in your `build.gradle` match installed components
4. If you see "license not accepted" errors, run `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses`

## "adb-shell command blocked"

replicant-mcp blocks potentially dangerous shell commands (like `rm -rf`, `su`, `reboot`, `dd`) to protect your device from accidental damage. This is by design.

If your command was blocked:
- Check [security.md](security.md) for the full denylist and rationale
- Use app-level operations (`adb-app`) instead where possible
- Shell metacharacters (`;`, `|`, `&`, backticks) are also blocked to prevent command chaining

If you believe a command was blocked incorrectly, review the error message -- it will indicate whether the block was triggered by the command denylist or the metacharacter filter.

## Screenshots are empty or corrupted

The emulator may not be fully booted, or the screen may be off. Before capturing screenshots:

1. Verify the device is online: `adb-device` with `operation: "list"` should show status "device" (not "offline" or "booting")
2. Make sure the screen is on and unlocked -- use `adb-shell` with `command: "input keyevent KEYCODE_WAKEUP"` to wake it
3. Try `ui` with `operation: "dump"` first to confirm the UI accessibility tree is available
4. If the screenshot file exists but is empty, the emulator's GPU rendering may need a moment after boot -- wait a few seconds and retry

For persistent issues, see the OCR and visual mode notes in [known-limitations.md](known-limitations.md).

## Enable debug logging

Set these environment variables before starting the server:

```bash
export REPLICANT_LOG_LEVEL=debug    # Options: error, warn (default), info, debug
export REPLICANT_LOG_FORMAT=json    # For structured logs (default: plain text)
```

Logs go to stderr, so they won't interfere with the MCP protocol on stdout. This is especially useful for diagnosing timeout issues, command failures, or unexpected tool behavior. See [configuration.md](configuration.md) for the full list of environment variables.

## OCR / text recognition not working

OCR (used in visual mode for `ui` operations) relies on tesseract.js, which is included as a dependency. Things to know:

- The first run may be slow because tesseract.js downloads its language model on demand
- Accuracy depends on text size, font, and contrast -- small or low-contrast text may not be recognized reliably
- The accessibility-first approach (`ui dump` and `ui find`) is preferred over OCR when possible

If OCR consistently fails, try increasing the screenshot resolution via `ui.maxImageDimension` in your config file. For apps with custom rendering (Flutter, games), consider adding the package to `ui.visualModePackages` in your config. See [known-limitations.md](known-limitations.md) for more on accessibility tree gaps.
