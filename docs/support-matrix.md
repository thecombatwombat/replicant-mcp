# Support Matrix

This table shows which environments are tested in CI and which are supported on a best-effort basis.

| Component | Tested (CI) | Best Effort |
|-----------|-------------|-------------|
| OS | macOS, Linux (Ubuntu) | Windows |
| Node.js | 18.x, 20.x, 22.x | -- |
| Android SDK | build-tools 33+ | -- |
| ADB | platform-tools 33+ | -- |
| JDK | 17+ | -- |
| Emulator | Google APIs x86_64 | ARM (Apple Silicon via Rosetta) |

## Notes

- **CI matrix**: Defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). The primary test matrix runs on Ubuntu with Node 18, 20, and 22. A separate job runs build and unit tests on Windows.
- **Node.js versions**: The minimum supported version is Node 18, as declared in `package.json` `engines` field.
- **Emulator tests**: Full emulator integration tests run on Ubuntu with API level 30, x86_64 architecture. Apple Silicon Macs run emulators via Rosetta translation, which is functional but not CI-tested.
- **Windows**: Build and unit tests pass on Windows in CI. Emulator and integration tests are Linux-only. Windows-specific bugs are addressed on a best-effort basis.
- **Android SDK**: replicant-mcp requires Android build-tools 33+ and platform-tools 33+ for full functionality. Older versions may work but are not tested.
