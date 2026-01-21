# Video Capture for UI Automation

**Status:** Design complete
**Epic:** Video Capture
**Created:** 2025-01-21

## Overview

Record device screen during UI automation for debugging failed interactions, documenting app flows, and capturing evidence of flaky tests.

## Goals

- Explicit start/stop recording for long flows
- Duration-based recording for quick captures
- MP4 format (Android native)
- Configurable output directory (default: temp)

## Non-goals (for now)

- WebM/GIF conversion (requires ffmpeg - Phase 2)
- Audio recording
- Recording on locked devices (Android limitation)

## Future Work

- Optional ffmpeg dependency for format conversion
- WebM for smaller file sizes
- GIF for quick previews/sharing

## Android Limitations

- Max 3 minutes per recording
- Device must be unlocked
- One recording per device at a time

## Tool Operations

### `start-recording` - Begin recording

```typescript
// Input
{ operation: "start-recording" }

// Output
{
  recording: true,
  maxDurationSeconds: 180,
  deviceId: "emulator-5554",
  hint: "Call stop-recording to save video. Max duration: 3 minutes."
}
```

### `stop-recording` - Stop and save

```typescript
// Input
{ operation: "stop-recording" }

// Output
{
  videoPath: "/tmp/replicant-video-1705812345.mp4",
  durationSeconds: 12.5,
  deviceId: "emulator-5554"
}
```

### `record` - Duration-based capture

```typescript
// Input
{ operation: "record", durationSeconds: 5 }

// Output (after duration completes)
{
  videoPath: "/tmp/replicant-video-1705812345.mp4",
  durationSeconds: 5,
  deviceId: "emulator-5554"
}
```

### Error Cases

- `start-recording` when already recording → error
- `stop-recording` when not recording → error
- `record` with duration > 180 → clamp to 180 with warning

## Configuration

Extends `replicant.yaml`:

```yaml
ui:
  # ... visual fallback config

video:
  # Output directory for videos (default: system temp)
  outputDir: "/path/to/videos"

  # Default duration for 'record' operation in seconds (default: 10)
  defaultDuration: 10

  # Video resolution - "original" or "720p" or "480p" (default: original)
  resolution: "720p"

  # Bitrate in Mbps (default: 4)
  bitrate: 4

build:
  # ... build config
```

**Defaults:**
```typescript
const DEFAULT_VIDEO_CONFIG = {
  outputDir: os.tmpdir(),
  defaultDuration: 10,
  resolution: "original",
  bitrate: 4,
};
```

**CI-friendly example:**
```yaml
video:
  outputDir: "./build/test-videos"
  resolution: "480p"
  bitrate: 2
```

## Implementation

**Files to modify:**

1. `src/types/index.ts` - Add `VideoConfig` interface, recording state type
2. `src/config.ts` - Add `video` section parsing
3. `src/tools/ui.ts` - Add `start-recording`, `stop-recording`, `record` operations
4. `src/services/ui.ts` - Add video methods (startRecording, stopRecording, record)
5. `src/server.ts` - Add recording state to context, handle cleanup on shutdown

**ADB commands used:**

```bash
# Start recording
adb shell screenrecord --size 1280x720 --bit-rate 4000000 /sdcard/recording.mp4

# Stop (kill the process)
adb shell pkill -INT screenrecord

# Pull file
adb pull /sdcard/recording.mp4 /local/path/video.mp4

# Cleanup
adb shell rm /sdcard/recording.mp4
```

**Tests to add:**
- Start/stop recording flow
- Duration-based recording
- Error when already recording
- Config options applied correctly
- Cleanup on server shutdown

## Phased Roadmap

**Phase 1 (this design):**
- MP4 recording only
- start/stop and duration-based modes
- Configurable output directory and quality

**Phase 2:**
- Optional ffmpeg dependency
- Format conversion: MP4 → WebM, GIF
- Smaller file sizes for CI artifacts
