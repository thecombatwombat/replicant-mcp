# Troubleshooting

## "No device selected"

Run `adb-device` with `operation: "list"` to see available devices, then `operation: "select"` to choose one. If only one device is connected, it's auto-selected.

## "Gradle wrapper not found"

Make sure you're in an Android project directory that contains `gradlew`. The Gradle tools won't work from other locations.

## "Command timed out"

Long-running operations (builds, tests) have a 5-minute default timeout. If your builds are slower, you may need to adjust the timeout in the adapter.

## Emulator won't start

Check that:
1. You have an AVD created (`avdmanager list avd`)
2. Virtualization is enabled (KVM on Linux, HAXM on Mac/Windows)
3. Enough disk space for the emulator
