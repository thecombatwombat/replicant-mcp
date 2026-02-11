# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Pre-push hook to block direct pushes to master
- Enforce test coverage thresholds in CI

### Fixed

- Validate adb shell payloads against blocked commands
- Eliminate SessionStart hook errors from sync lock contention
- Prevent SessionStart hook timeout in interactive sessions
- Adjust coverage thresholds and exclude CLI wrappers

## [1.4.8] - 2026-02-06

### Fixed

- Remove double-publish from release script

## [1.4.7] - 2026-02-06

### Changed

- Decompose handleUiTool and add code health guardrails

### Added

- Harden beads sync for multi-agent environments
- Bulletproof beads sync for 30-50 agent scale

### Fixed

- Use bd sync --full in SessionEnd hook

## [1.4.6] - 2026-01-26

### Changed

- Optimize screenshot compression with WebP and sharpening

## [1.4.5] - 2026-01-26

### Fixed

- Windows SDK and PATH discovery support

## [1.4.4] - 2026-01-26

### Fixed

- Return screenshots as MCP image content blocks

## [1.4.3] - 2026-01-26

### Fixed

- Add pagination to ui dump compact mode
- Include rtfm docs in npm package

## [1.4.2] - 2026-01-26

### Fixed

- Add warning when ui dump returns empty results
- Reduce context exhaustion from MCP tool responses

## [1.4.1] - 2026-01-26

### Added

- Sandbox-safe screenshot path utility

### Changed

- Use shared path utility in UiAutomatorAdapter

## [1.4.0] - 2026-01-26

### Added

- Add deviceSpace parameter to ui tap for device-coordinate input

### Fixed

- Inline screenshot scaling with JPEG compression

## [1.3.2] - 2026-01-23

### Fixed

- Use image dimensions for Tier 5 grid refinement when scaling active

## [1.3.1] - 2026-01-23

### Added

- Screenshot scaling for UI automation

## [1.3.0] - 2026-01-23

### Added

- Scroll operation for ui tool
- Compact mode for ui dump
- Release script with --dry-run option

### Fixed

- Default screenshot inline to true
- Add pre-flight checks to release script

## [1.2.1] - 2026-01-23

Release infrastructure fixes.

## [1.2.0] - 2026-01-23

### Added

- Screenshot scaling with maxDimension and raw parameters
- Coordinate conversion between device and image space
- Automatic tap coordinate conversion to device space
- Bounds conversion to image space in dump output
- ScalingState tracking and maxImageDimension config option

## [1.1.1] - 2026-01-21

### Fixed

- Auto-build before start to prevent stale dist

## [1.1.0] - 2026-01-21

### Added

- MCP guidance and project-relative screenshots
- Icon recognition with spatial nearestTo matching
- Visual fallback for UI automation (Phase 1)
- Roadmap documentation check for PR workflow

## [1.0.4] - 2026-01-21

Release infrastructure fixes.

## [1.0.3] - 2026-01-21

### Added

- OCR fallback for UI text search

## [1.0.2] - 2026-01-21

Release infrastructure fixes.

## [1.0.1] - 2026-01-21

### Added

- Initial release of replicant-mcp Android MCP server
- MCP tools: adb-device, adb-app, adb-logcat, adb-shell, emulator-device, gradle-build, gradle-test, gradle-list, gradle-get-details, ui, cache, rtfm
- Just Works UX with auto SDK detection, device selection, and working screenshots
- Progressive disclosure pattern with cache IDs for detailed output
- Claude Code plugin marketplace support
- CLI with formatters for token-efficient summaries
- DeviceStateManager with auto-selection
- CacheManager with LRU eviction and TTL
- ProcessRunner with safety guards
- UI Automator adapter with accessibility tree parsing
- Gradle adapter with build, test, and introspection
- Emulator adapter with AVD and snapshot management
- ADB adapter with device and app management

[Unreleased]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.8...HEAD
[1.4.8]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.7...v1.4.8
[1.4.7]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.6...v1.4.7
[1.4.6]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.5...v1.4.6
[1.4.5]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.4...v1.4.5
[1.4.4]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.3...v1.4.4
[1.4.3]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.2...v1.4.3
[1.4.2]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.0.4...v1.1.0
[1.0.4]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/thecombatwombat/replicant-mcp/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/thecombatwombat/replicant-mcp/releases/tag/v1.0.1
