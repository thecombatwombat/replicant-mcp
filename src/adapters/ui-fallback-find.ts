import { flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";
import { extractText, searchText } from "../services/ocr.js";
import { matchIconPattern, matchesResourceId } from "../services/icon-patterns.js";
import { filterIconCandidates, formatBounds, cropCandidateImage } from "../services/visual-candidates.js";
import {
  calculateGridCellBounds,
  calculatePositionCoordinates,
  createGridOverlay,
  POSITION_LABELS,
} from "../services/grid.js";
import { boundsToImageSpace, toDeviceSpace } from "../services/scaling.js";
import type { OcrElement } from "../types/ocr.js";
import {
  FindWithFallbacksResult,
  FindOptions,
  FindTier,
  VisualCandidate,
} from "../types/icon-recognition.js";
import type { ScreenMetadata, ScalingState, ScreenshotResult } from "./ui-automator.js";
import type { VisualSnapshot } from "../types/index.js";

export interface FallbackFindDeps {
  find(deviceId: string, selector: Record<string, string | undefined>): Promise<AccessibilityNode[]>;
  dump(deviceId: string): Promise<AccessibilityNode[]>;
  screenshot(deviceId: string, options?: Record<string, unknown>): Promise<ScreenshotResult>;
  getScreenMetadata(deviceId: string): Promise<ScreenMetadata>;
  visualSnapshot(deviceId: string, options?: { includeBase64?: boolean }): Promise<VisualSnapshot>;
  getScalingState(): ScalingState | null;
}

function ocrToDeviceSpace(elements: OcrElement[], scaleFactor: number): OcrElement[] {
  if (scaleFactor === 1.0) return elements;
  return elements.map((el) => {
    const center = toDeviceSpace(el.center.x, el.center.y, scaleFactor);
    const m = el.bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    let bounds = el.bounds;
    if (m) {
      const x0 = Math.round(parseInt(m[1], 10) * scaleFactor);
      const y0 = Math.round(parseInt(m[2], 10) * scaleFactor);
      const x1 = Math.round(parseInt(m[3], 10) * scaleFactor);
      const y1 = Math.round(parseInt(m[4], 10) * scaleFactor);
      bounds = `[${x0},${y0}][${x1},${y1}]`;
    }
    return { ...el, center, bounds };
  });
}

function gridResultToDeviceSpace(
  cellBounds: { x0: number; y0: number; x1: number; y1: number },
  coords: { x: number; y: number },
  scaleFactor: number,
): {
  bounds: string;
  center: { x: number; y: number };
} {
  if (scaleFactor === 1.0) {
    return {
      bounds: `[${cellBounds.x0},${cellBounds.y0}][${cellBounds.x1},${cellBounds.y1}]`,
      center: coords,
    };
  }
  return {
    bounds: `[${Math.round(cellBounds.x0 * scaleFactor)},${Math.round(cellBounds.y0 * scaleFactor)}]` +
            `[${Math.round(cellBounds.x1 * scaleFactor)},${Math.round(cellBounds.y1 * scaleFactor)}]`,
    center: {
      x: Math.round(coords.x * scaleFactor),
      y: Math.round(coords.y * scaleFactor),
    },
  };
}

function createEarlyStopResult(
  tier: FindTier,
  source: "accessibility" | "ocr" | "visual"
): FindWithFallbacksResult {
  return {
    elements: [],
    source,
    tier,
    confidence: "low",
    stoppedEarly: true,
    stoppedAtTier: tier,
    nextTierAvailable: tier < 5 ? ((tier + 1) as FindTier) : undefined,
    stopReason: "maxTier limit reached",
  };
}

export async function findWithFallbacks(
  deps: FallbackFindDeps,
  deviceId: string,
  selector: {
    resourceId?: string;
    text?: string;
    textContains?: string;
    className?: string;
  },
  options: FindOptions = {}
): Promise<FindWithFallbacksResult> {
  const maxTier = options.maxTier ?? 5;

  // Handle Tier 5 grid refinement FIRST (when gridCell and gridPosition are provided)
  if (options.gridCell !== undefined && options.gridPosition !== undefined) {
    let width: number, height: number;
    let gridScaleFactor = 1.0;
    const scalingState = deps.getScalingState();
    if (scalingState && scalingState.scaleFactor !== 1.0) {
      width = scalingState.imageWidth;
      height = scalingState.imageHeight;
      gridScaleFactor = scalingState.scaleFactor;
    } else {
      const screen = await deps.getScreenMetadata(deviceId);
      width = screen.width;
      height = screen.height;
    }
    const cellBounds = calculateGridCellBounds(options.gridCell, width, height);
    const coords = calculatePositionCoordinates(options.gridPosition, cellBounds);
    const deviceCoords = gridResultToDeviceSpace(cellBounds, coords, gridScaleFactor);

    return {
      elements: [
        {
          index: 0,
          bounds: deviceCoords.bounds,
          center: deviceCoords.center,
        },
      ],
      source: "grid",
      tier: 5,
      confidence: "low",
    };
  }

  // Tier 1: Accessibility text match
  const accessibilityResults = await deps.find(deviceId, selector);

  if (accessibilityResults.length > 0) {
    return {
      elements: accessibilityResults,
      source: "accessibility",
      tier: 1,
      confidence: "high",
    };
  }

  if (maxTier === 1) {
    return createEarlyStopResult(1, "accessibility");
  }

  // Tier 2: ResourceId pattern match (for text-based queries)
  if (selector.text || selector.textContains) {
    const query = selector.text || selector.textContains!;
    const patterns = matchIconPattern(query);

    if (patterns) {
      const tree = await deps.dump(deviceId);
      const flat = flattenTree(tree);
      const patternMatches = flat.filter(
        (node) => node.resourceId && matchesResourceId(node.resourceId, patterns)
      );

      if (patternMatches.length > 0) {
        return {
          elements: patternMatches,
          source: "accessibility",
          tier: 2,
          confidence: "high",
          fallbackReason: options.debug
            ? "no text match, found via resourceId pattern"
            : undefined,
        };
      }
    }

    if (maxTier === 2) {
      return createEarlyStopResult(2, "accessibility");
    }
  }

  // Tier 3: OCR
  if ((selector.text || selector.textContains) && maxTier >= 3) {
    const searchTerm = selector.text || selector.textContains!;
    const screenshotResult = await deps.screenshot(deviceId, {});
    const scalingState = deps.getScalingState();
    const scaleFactor = scalingState?.scaleFactor ?? 1.0;

    try {
      const ocrResults = await extractText(screenshotResult.path!);
      const matches = searchText(ocrResults, searchTerm);

      if (matches.length > 0) {
        return {
          elements: ocrToDeviceSpace(matches, scaleFactor),
          source: "ocr",
          tier: 3,
          confidence: "high",
          fallbackReason: options.debug
            ? "no accessibility or pattern match, found via OCR"
            : undefined,
        };
      }

      if (maxTier === 3) {
        return createEarlyStopResult(3, "ocr");
      }

      // Tier 4: Visual candidates (unlabeled clickables)
      const tree = await deps.dump(deviceId);
      const flat = flattenTree(tree);
      const iconCandidates = filterIconCandidates(flat);

      if (iconCandidates.length > 0) {
        // Crop the screenshot using image-space bounds (dump now returns device-space).
        const candidates: VisualCandidate[] = await Promise.all(
          iconCandidates.map(async (node, index) => ({
            index,
            bounds: formatBounds(node),
            center: { x: node.centerX, y: node.centerY },
            image: await cropCandidateImage(
              screenshotResult.path!,
              boundsToImageSpace(node.bounds, scaleFactor),
            ),
          }))
        );

        const allUnlabeled = flat.filter((n) => n.clickable && !n.text && !n.contentDesc);

        return {
          elements: [],
          source: "visual",
          tier: 4,
          confidence: "medium",
          candidates,
          truncated: iconCandidates.length < allUnlabeled.length,
          totalCandidates: allUnlabeled.length,
          fallbackReason: options.debug
            ? "no text/pattern/OCR match, showing visual candidates"
            : undefined,
        };
      }

      if (maxTier === 4) {
        return createEarlyStopResult(4, "visual");
      }

      // Tier 5: Grid fallback
      const gridImage = await createGridOverlay(screenshotResult.path!);

      return {
        elements: [],
        source: "grid",
        tier: 5,
        confidence: "low",
        gridImage,
        gridPositions: POSITION_LABELS,
        fallbackReason: options.debug
          ? "no usable elements, showing grid for coordinate selection"
          : undefined,
      };
    } finally {
      if (screenshotResult.path) {
        const fs = await import("fs/promises");
        await fs.unlink(screenshotResult.path).catch(() => {});
      }
    }
  }

  // No text selector - return empty with visual fallback if requested
  if (options.includeVisualFallback) {
    const snapshot = await deps.visualSnapshot(deviceId, {
      includeBase64: options.includeBase64,
    });

    return {
      elements: [],
      source: "accessibility",
      tier: 1,
      confidence: "high",
      visualFallback: {
        ...snapshot,
        hint: "No elements matched selector. Use screenshot to identify tap coordinates.",
      },
    };
  }

  return {
    elements: [],
    source: "accessibility",
    tier: 1,
    confidence: "high",
  };
}
