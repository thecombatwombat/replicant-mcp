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
import {
  FindWithFallbacksResult,
  FindOptions,
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
  // Handle Tier 5 grid refinement FIRST (when gridCell and gridPosition are provided)
  if (options.gridCell !== undefined && options.gridPosition !== undefined) {
    let width: number, height: number;
    const scalingState = deps.getScalingState();
    if (scalingState && scalingState.scaleFactor !== 1.0) {
      width = scalingState.imageWidth;
      height = scalingState.imageHeight;
    } else {
      const screen = await deps.getScreenMetadata(deviceId);
      width = screen.width;
      height = screen.height;
    }
    const cellBounds = calculateGridCellBounds(options.gridCell, width, height);
    const coords = calculatePositionCoordinates(options.gridPosition, cellBounds);

    return {
      elements: [
        {
          index: 0,
          bounds: `[${cellBounds.x0},${cellBounds.y0}][${cellBounds.x1},${cellBounds.y1}]`,
          center: coords,
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
  }

  // Tier 3: OCR
  if (selector.text || selector.textContains) {
    const searchTerm = selector.text || selector.textContains!;
    const screenshotResult = await deps.screenshot(deviceId, {});

    try {
      const ocrResults = await extractText(screenshotResult.path!);
      const matches = searchText(ocrResults, searchTerm);

      if (matches.length > 0) {
        return {
          elements: matches,
          source: "ocr",
          tier: 3,
          confidence: "high",
          fallbackReason: options.debug
            ? "no accessibility or pattern match, found via OCR"
            : undefined,
        };
      }

      // Tier 4: Visual candidates (unlabeled clickables)
      const tree = await deps.dump(deviceId);
      const flat = flattenTree(tree);
      const iconCandidates = filterIconCandidates(flat);

      if (iconCandidates.length > 0) {
        const candidates: VisualCandidate[] = await Promise.all(
          iconCandidates.map(async (node, index) => ({
            index,
            bounds: formatBounds(node),
            center: { x: node.centerX, y: node.centerY },
            image: await cropCandidateImage(screenshotResult.path!, node.bounds),
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
