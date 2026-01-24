# Visual Content Analysis for Accessibility-Poor UIs

**Status:** Problem analysis complete, needs deeper design
**Issue:** replicant-mcp-qik
**Date:** 2026-01-23

## Problem Statement

Android apps with canvas-based rendering, WebViews, or image-heavy UIs provide sparse accessibility data. When agents rely on `ui dump` for element identification, they fail to locate or interact with visual content that lacks text descriptions.

### Observed Failure Modes

1. **Canvas-based apps** - Games, drawing apps, and apps using custom rendering return minimal accessibility nodes
2. **Ad content** - Promoted/sponsored content often lacks alt-text or content descriptions
3. **Image galleries** - Photos, pins, and media thumbnails may only have generic labels ("Image", "Photo")
4. **WebViews** - Embedded web content may not expose accessibility properly

### Example Scenario

An agent asked to "find the ad with a woman in it" on an image-heavy feed:
- Accessibility dump returns: `"Title: Don't miss our Gold Medal Celebration"`
- Actual visual content: Woman with curly hair, brand logo, promotional imagery
- Agent sees the ad exists but cannot identify its visual content
- Agent scrolls past the target repeatedly, unable to match visual criteria

## Current Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │────▶│ replicant   │────▶│   Device    │
│  (Claude)   │     │    MCP      │     │  (ADB)      │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │ ui dump           │ uiautomator dump
       │ ──────────────────│───────────────────▶
       │                   │
       │ ui screenshot     │ screencap -p
       │ ──────────────────│───────────────────▶
       │                   │
       ▼                   ▼
  Agent receives:     MCP returns:
  - Accessibility     - Raw tree or
    tree (sparse)       flat elements
  - Raw image         - Base64 PNG
    (unstructured)
```

**Gap:** When accessibility fails, agents receive an unstructured image with no guidance about what's in it or where to look.

## Proposed Solution: Opt-in Visual Enrichment

Add optional analysis that extracts additional information from screenshots without slowing down the default fast path.

### Design Principles

1. **Speed by default** - Standard operations remain fast; analysis is opt-in
2. **Additive data** - Enrichment supplements, doesn't replace, existing outputs
3. **Agent autonomy** - MCP provides data; agent decides how to use it

### Proposed Interface

**Option A: Inline parameter**
```json
{
  "operation": "screenshot",
  "analyze": true
}
```

Returns:
```json
{
  "image": "base64...",
  "analysis": {
    "ocr": [
      { "text": "Xfinity Mobile", "bounds": [545, 1004, 1070, 1100], "confidence": 0.95 },
      { "text": "Get the most reliable 5G", "bounds": [...], "confidence": 0.92 }
    ]
  }
}
```

**Option B: Separate operation**
```json
{
  "operation": "analyze",
  "screenshotId": "screenshot-abc123"
}
```

Operates on a previously captured screenshot, avoiding re-capture overhead.

**Option C: Combined visual-dump**
```json
{
  "operation": "visual-dump"
}
```

Returns accessibility tree + screenshot + OCR in one response.

### Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| Inline parameter | Simple API, single call | Slower for all screenshot calls that use it |
| Separate operation | Capture fast, analyze later | Two calls needed, agent must manage IDs |
| Combined visual-dump | Complete picture in one call | Always slow, may be overkill |

**Recommendation:** Start with Option A (inline parameter). Simpler to implement and evaluate. Can add Option B later if capture-then-analyze pattern proves valuable.

## Implementation Considerations

### OCR Engine Options

| Engine | Speed | Accuracy | Deployment |
|--------|-------|----------|------------|
| Tesseract | Slow | Good | Local, no deps |
| Google Cloud Vision | Fast | Excellent | Requires API key, cost |
| Apple Vision (macOS) | Fast | Good | macOS only |
| ML Kit (on-device) | Medium | Good | Requires device setup |

**Recommendation:** Start with Tesseract for portability. Benchmark and consider Cloud Vision if speed is critical.

### Response Size

OCR adds data to responses. Consider:
- Filtering low-confidence results
- Limiting to N results
- Optional verbosity levels

## Evaluation Plan

### Success Criteria

1. **Task completion rate** - Can agents find visual targets they previously missed?
2. **Latency impact** - How much slower is `analyze: true`?
3. **False positive rate** - Does OCR introduce confusion?

### Test Cases

1. **Ad identification** - Find specific ad by visual description
2. **Brand recognition** - Locate element with specific brand/logo text
3. **Text-in-image** - Find button/label rendered as image
4. **Mixed content** - Feed with both accessible and inaccessible items

### Benchmarks Needed

- Baseline: screenshot latency without analysis
- With Tesseract OCR
- With Cloud Vision (if evaluated)
- End-to-end task completion time

## Open Questions

1. Should OCR run on device (via termux/ML Kit) or host?
2. How to handle non-English text?
3. Should we also extract color/shape information?
4. How to correlate OCR regions with accessibility bounds?

## Next Steps

1. Prototype Tesseract integration
2. Build eval harness with visual identification tasks
3. Benchmark latency
4. Validate with real agent workflows
