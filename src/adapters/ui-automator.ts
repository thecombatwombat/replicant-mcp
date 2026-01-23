import * as path from "path";
import * as fs from "fs";
import { AdbAdapter } from "./adb.js";
import { parseUiDump, findElements, flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";
import { ReplicantError, ErrorCode, OcrElement, VisualSnapshot } from "../types/index.js";
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
  FindOptions as IconFindOptions,
  VisualCandidate,
} from "../types/icon-recognition.js";

export interface ScreenMetadata {
  width: number;
  height: number;
  density: number;
}

export interface CurrentApp {
  packageName: string;
  activityName: string;
}

export interface ScreenshotOptions {
  localPath?: string;
  inline?: boolean;
}

export interface ScreenshotResult {
  mode: "file" | "inline";
  path?: string;
  base64?: string;
  sizeBytes?: number;
}

// Backward compatibility alias - use FindWithFallbacksResult for new code
export type FindWithOcrResult = FindWithFallbacksResult;

// Re-export FindOptions from icon-recognition types for backward compatibility
export type FindOptions = IconFindOptions;

/**
 * Tracks the current scaling state between device and image coordinates.
 * Updated on every screenshot operation.
 */
export interface ScalingState {
  scaleFactor: number;
  deviceWidth: number;
  deviceHeight: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Get default screenshot path in project-relative .replicant/screenshots directory.
 * Creates the directory if it doesn't exist.
 */
function getDefaultScreenshotPath(): string {
  const dir = path.join(process.cwd(), ".replicant", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `screenshot-${Date.now()}.png`);
}

export class UiAutomatorAdapter {
  private scalingState: ScalingState | null = null;

  constructor(private adb: AdbAdapter = new AdbAdapter()) {}

  // Getter for tests
  getScalingState(): ScalingState | null {
    return this.scalingState;
  }

  async dump(deviceId: string): Promise<AccessibilityNode[]> {
    // Dump UI hierarchy to device
    await this.adb.shell(deviceId, "uiautomator dump /sdcard/ui-dump.xml");

    // Pull the dump
    const result = await this.adb.shell(deviceId, "cat /sdcard/ui-dump.xml");

    // Clean up
    await this.adb.shell(deviceId, "rm /sdcard/ui-dump.xml");

    return parseUiDump(result.stdout);
  }

  async find(
    deviceId: string,
    selector: {
      resourceId?: string;
      text?: string;
      textContains?: string;
      className?: string;
    }
  ): Promise<AccessibilityNode[]> {
    const tree = await this.dump(deviceId);
    return findElements(tree, selector);
  }

  async tap(deviceId: string, x: number, y: number): Promise<void> {
    await this.adb.shell(deviceId, `input tap ${x} ${y}`);
  }

  async tapElement(deviceId: string, element: AccessibilityNode): Promise<void> {
    await this.tap(deviceId, element.centerX, element.centerY);
  }

  async input(deviceId: string, text: string): Promise<void> {
    // Escape special characters for shell
    const escaped = text.replace(/(['"\\$`])/g, "\\$1").replace(/ /g, "%s");
    await this.adb.shell(deviceId, `input text "${escaped}"`);
  }

  async screenshot(deviceId: string, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const remotePath = "/sdcard/replicant-screenshot.png";

    // Capture screenshot on device
    const captureResult = await this.adb.shell(deviceId, `screencap -p ${remotePath}`);
    if (captureResult.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.SCREENSHOT_FAILED,
        "Failed to capture screenshot",
        captureResult.stderr || "Ensure device screen is on and unlocked"
      );
    }

    try {
      if (options.inline) {
        // Inline mode: return base64
        const base64Result = await this.adb.shell(deviceId, `base64 ${remotePath}`);
        const sizeResult = await this.adb.shell(deviceId, `stat -c%s ${remotePath}`);
        return {
          mode: "inline",
          base64: base64Result.stdout.trim(),
          sizeBytes: parseInt(sizeResult.stdout.trim(), 10),
        };
      } else {
        // File mode (default): pull to local
        const localPath = options.localPath || getDefaultScreenshotPath();
        await this.adb.pull(deviceId, remotePath, localPath);
        return { mode: "file", path: localPath };
      }
    } finally {
      // Always clean up remote file
      await this.adb.shell(deviceId, `rm -f ${remotePath}`);
    }
  }

  async accessibilityCheck(deviceId: string): Promise<{
    hasAccessibleElements: boolean;
    clickableCount: number;
    textCount: number;
    totalElements: number;
  }> {
    const tree = await this.dump(deviceId);
    const flat = flattenTree(tree);

    const clickableCount = flat.filter((n) => n.clickable).length;
    const textCount = flat.filter((n) => n.text || n.contentDesc).length;

    return {
      hasAccessibleElements: textCount > 0,
      clickableCount,
      textCount,
      totalElements: flat.length,
    };
  }

  async getScreenMetadata(deviceId: string): Promise<ScreenMetadata> {
    // Get screen size via wm size
    const sizeResult = await this.adb.shell(deviceId, "wm size");
    const sizeMatch = sizeResult.stdout.match(/Physical size:\s*(\d+)x(\d+)/);

    let width = 1080;
    let height = 1920;
    if (sizeMatch) {
      width = parseInt(sizeMatch[1], 10);
      height = parseInt(sizeMatch[2], 10);
    }

    // Get density via wm density
    const densityResult = await this.adb.shell(deviceId, "wm density");
    const densityMatch = densityResult.stdout.match(/Physical density:\s*(\d+)/);

    // Convert DPI to density multiplier (baseline is 160 dpi)
    let density = 2.75; // Default reasonable value
    if (densityMatch) {
      const dpi = parseInt(densityMatch[1], 10);
      density = dpi / 160;
    }

    return { width, height, density };
  }

  async getCurrentApp(deviceId: string): Promise<CurrentApp> {
    // Get current focused activity
    const result = await this.adb.shell(
      deviceId,
      "dumpsys activity activities | grep mResumedActivity"
    );

    // Parse: mResumedActivity: ActivityRecord{... com.example/.MainActivity t123}
    const match = result.stdout.match(/([a-zA-Z0-9_.]+)\/([a-zA-Z0-9_.]+)\s+/);

    if (match) {
      return {
        packageName: match[1],
        activityName: match[2],
      };
    }

    // Fallback to simpler approach
    const fallbackResult = await this.adb.shell(
      deviceId,
      "dumpsys window | grep mCurrentFocus"
    );
    const fallbackMatch = fallbackResult.stdout.match(/([a-zA-Z0-9_.]+)\/([a-zA-Z0-9_.]+)/);

    if (fallbackMatch) {
      return {
        packageName: fallbackMatch[1],
        activityName: fallbackMatch[2],
      };
    }

    return {
      packageName: "unknown",
      activityName: "unknown",
    };
  }

  async visualSnapshot(
    deviceId: string,
    options: { includeBase64?: boolean } = {}
  ): Promise<VisualSnapshot> {
    // Always get file-based screenshot first
    const [screenshotResult, screen, app] = await Promise.all([
      this.screenshot(deviceId, {}),
      this.getScreenMetadata(deviceId),
      this.getCurrentApp(deviceId),
    ]);

    const snapshot: VisualSnapshot = {
      screenshotPath: screenshotResult.path!,
      screen,
      app,
    };

    // Optionally also get base64 encoding from local file
    if (options.includeBase64 && screenshotResult.path) {
      const fs = await import("fs/promises");
      const buffer = await fs.readFile(screenshotResult.path);
      snapshot.screenshotBase64 = buffer.toString("base64");
    }

    return snapshot;
  }

  async findWithFallbacks(
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
      const screen = await this.getScreenMetadata(deviceId);
      const cellBounds = calculateGridCellBounds(options.gridCell, screen.width, screen.height);
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
    const accessibilityResults = await this.find(deviceId, selector);

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
        const tree = await this.dump(deviceId);
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

    // Tier 3: OCR (existing logic)
    if (selector.text || selector.textContains) {
      const searchTerm = selector.text || selector.textContains!;

      // Take screenshot for OCR
      const screenshotResult = await this.screenshot(deviceId, {});

      try {
        // Run OCR
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
        const tree = await this.dump(deviceId);
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

        // Tier 5: Grid fallback (empty or unusable accessibility tree)
        const screen = await this.getScreenMetadata(deviceId);
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
        // Always clean up screenshot - Tier 3/4/5 all embed base64 data in response
        if (screenshotResult.path) {
          const fs = await import("fs/promises");
          await fs.unlink(screenshotResult.path).catch(() => {});
        }
      }
    }

    // No text selector - return empty with visual fallback if requested
    if (options.includeVisualFallback) {
      const snapshot = await this.visualSnapshot(deviceId, {
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

  // Backward compatible alias
  async findWithOcrFallback(
    deviceId: string,
    selector: {
      resourceId?: string;
      text?: string;
      textContains?: string;
      className?: string;
    },
    options: FindOptions = {}
  ): Promise<FindWithFallbacksResult> {
    return this.findWithFallbacks(deviceId, selector, options);
  }
}
