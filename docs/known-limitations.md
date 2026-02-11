# Known Limitations

This document lists known limitations and constraints of replicant-mcp. Understanding these helps set expectations and guides you toward workarounds.

## Accessibility Tree Gaps

The `ui dump` and `ui find` commands rely on Android's accessibility tree. Apps that use custom rendering (Flutter, game engines, video players, canvas-based UIs) may not expose accessibility nodes. In these cases, use `ui visual-snapshot` or `ui screenshot` instead.

## Single-Device Focus

replicant-mcp works with one active device at a time. If multiple devices or emulators are connected, use `adb-device list` to see them and `adb-device select` to choose which one to target. There is no support for parallel multi-device operations.

## Emulator-Only CI

CI runs use Android emulators on Linux (Ubuntu). Real physical device testing requires a local setup with a device connected via USB or Wi-Fi. Real devices are not tested in CI.

## Gradle Wrapper Required

Gradle commands require `gradlew` (the Gradle wrapper script) to be present in the project root. Projects without a Gradle wrapper are not supported. Set the project root via `REPLICANT_PROJECT_ROOT` or `build.projectRoot` in your config file (see [configuration.md](configuration.md)).

## 5-Minute Timeout Default

Long-running operations (Gradle builds, large APK installs, emulator boot) have a default timeout of 5 minutes. Very large projects or slow machines may hit this limit. There is currently no user-facing configuration to override the timeout.

## OCR Accuracy

OCR-based text recognition (used in visual mode) varies in accuracy depending on font, text size, contrast, and screen density. Small or low-contrast text may not be recognized reliably. Prefer accessibility-based `ui find` when possible.

## No Windows CI

Windows is supported on a best-effort basis. CI tests run on Windows to verify builds and unit tests pass, but emulator-based integration tests only run on Linux. Windows-specific issues may take longer to diagnose and fix.

## adb-logcat Timestamp Format

The `since` parameter on `adb-logcat` requires the adb timestamp format (e.g., `'01-20 15:30:00.000'`). Relative time expressions like `'5m'` or `'1h'` are **not** supported. Use the exact `MM-DD HH:MM:SS.mmm` format that adb expects.
