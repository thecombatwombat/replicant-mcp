# Screenshot Capture Speed Optimization

**Status:** Problem identified, needs investigation
**Issue:** replicant-mcp-izk
**Date:** 2026-01-23

## Problem Statement

Screenshot capture via ADB introduces latency that limits time-sensitive use cases. When agents need to react to specific moments (video frames, animations, transitions), the current capture speed may be insufficient.

### Use Cases Affected

1. **Animation debugging** - Capturing specific frames during transitions
2. **Video content analysis** - Identifying moments in playing video
3. **Timing verification** - Confirming UI appears at correct time
4. **Rapid iteration** - Fast screenshot-act-screenshot loops
5. **Flaky test debugging** - Capturing state at moment of failure

### Current Bottlenecks

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Agent calls  │───▶│ MCP spawns   │───▶│ Device runs  │
│ ui screenshot│    │ adb process  │    │ screencap    │
└──────────────┘    └──────────────┘    └──────────────┘
                           │                    │
                    Process spawn          Framebuffer
                    overhead               read + PNG
                           │               encode
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐    ┌──────────────┐
                    │ Transfer     │◀───│ PNG bytes    │
                    │ over USB/TCP │    │ (~1-3MB)     │
                    └──────────────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Host-side    │
                    │ resize/proc  │
                    └──────────────┘
```

**Estimated latency breakdown (needs benchmarking):**
- ADB process spawn: ~50-100ms
- screencap execution: ~200-500ms
- PNG transfer: ~100-300ms (varies by connection)
- Host processing: ~50-100ms
- **Total: ~400-1000ms per screenshot**

## Optimization Approaches

### 1. Persistent ADB Shell

Instead of spawning new `adb` process per command, maintain persistent shell connection.

```
Current:  adb exec-out screencap -p  (new process each time)
Proposed: adb shell (persistent) → screencap -p
```

**Savings:** ~50-100ms per call
**Complexity:** Low
**Trade-offs:** Need to manage shell lifecycle, handle disconnects

### 2. Alternative Capture Methods

#### minicap (Alibaba)

High-performance screen capture using native Android APIs.

- **Speed:** Can achieve 30+ FPS streaming
- **How:** Uses SurfaceFlinger directly, JPEG encoding
- **Deployment:** Requires pushing binary to device
- **Repo:** https://github.com/nicklockwood/minicap (or similar forks)

#### scrcpy

Screen mirroring tool with frame capture capability.

- **Speed:** 60 FPS possible
- **How:** Uses MediaCodec for hardware encoding
- **Deployment:** Requires scrcpy server on device
- **Bonus:** Can also handle input, useful for full automation

#### Framebuffer direct access

Read `/dev/graphics/fb0` directly (requires root).

- **Speed:** Very fast, no encoding overhead
- **Deployment:** Root required, format varies by device
- **Trade-offs:** Raw format, large data, device-specific

### 3. Encoding Optimizations

#### JPEG instead of PNG

```bash
# Current
adb exec-out screencap -p  # PNG, lossless, ~1-3MB

# Alternative (requires processing)
adb exec-out screencap | convert - -quality 80 jpeg:-  # JPEG, ~200-500KB
```

**Savings:** Faster encode, smaller transfer
**Trade-offs:** Lossy, may affect text readability at low quality

#### Raw format with host-side conversion

```bash
adb exec-out screencap  # Raw RGBA, no encoding on device
# Convert on host (faster CPU)
```

**Savings:** Faster device-side capture
**Trade-offs:** Larger transfer size, host must handle conversion

### 4. Resolution Reduction

Capture at lower resolution, scale up if needed.

```bash
# Capture at half resolution
adb shell wm size 540x1200  # Temporarily reduce
adb exec-out screencap -p
adb shell wm size reset
```

**Savings:** 4x less data at half resolution
**Trade-offs:** May miss fine details, affects global state

### 5. Emulator-Specific Optimizations

Android emulators may have faster paths:

- **gRPC API** - Direct frame access without ADB
- **Shared memory** - If emulator and host share memory
- **Host GPU rendering** - Frames already in host memory

**Trade-offs:** Not portable to physical devices

## Comparison Matrix

| Approach | Speed Gain | Complexity | Portability | Dependencies |
|----------|------------|------------|-------------|--------------|
| Persistent shell | Small | Low | High | None |
| minicap | Large | Medium | Medium | Binary on device |
| scrcpy | Large | Medium | Medium | scrcpy server |
| JPEG encoding | Medium | Low | High | ImageMagick or similar |
| Raw + host convert | Medium | Low | High | None |
| Resolution reduction | Medium | Low | High | None |
| Emulator APIs | Large | High | Low | Emulator-specific |

## Recommended Investigation Path

### Phase 1: Quick wins (low effort)

1. **Benchmark current state** - Measure actual latency breakdown
2. **Persistent shell** - Implement and measure improvement
3. **JPEG encoding** - Test quality vs speed trade-off

### Phase 2: Significant improvements (medium effort)

4. **minicap integration** - Prototype for high-FPS use cases
5. **Streaming mode** - Continuous capture for video/animation analysis

### Phase 3: Advanced (higher effort)

6. **scrcpy integration** - Full screen mirroring with capture
7. **Emulator-specific paths** - For development/testing scenarios

## Benchmarking Plan

### Metrics to Capture

1. **End-to-end latency** - Time from MCP call to response received
2. **Device-side time** - Just screencap execution
3. **Transfer time** - Bytes over wire
4. **Processing time** - Any host-side work
5. **Frames per second** - For streaming approaches

### Test Scenarios

1. **Single screenshot** - One-off capture latency
2. **Burst capture** - 10 screenshots in rapid succession
3. **Continuous stream** - Sustained FPS over 10 seconds
4. **With analysis** - Screenshot + OCR combined

### Devices to Test

- Emulator (various API levels)
- Physical device over USB
- Physical device over WiFi (adb tcpip)

## Open Questions

1. Is minicap actively maintained? Are there security concerns?
2. How do streaming approaches integrate with MCP's request/response model?
3. Should we support multiple capture backends with auto-selection?
4. What's the minimum acceptable latency for time-sensitive use cases?

## Next Steps

1. Implement latency benchmarking for current approach
2. Test persistent shell improvement
3. Evaluate minicap viability
4. Define "fast enough" threshold for target use cases
