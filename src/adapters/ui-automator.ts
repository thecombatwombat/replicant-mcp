import { AdbAdapter } from "./adb.js";
import { parseUiDump, findElements, flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";
import { ReplicantError, ErrorCode, OcrElement, VisualSnapshot } from "../types/index.js";
import { extractText, searchText } from "../services/ocr.js";

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

export interface FindWithOcrResult {
  elements: (AccessibilityNode | OcrElement)[];
  source: "accessibility" | "ocr";
  fallbackReason?: string;
  visualFallback?: VisualSnapshot;
}

export interface FindOptions {
  debug?: boolean;
  /** Include visual fallback (screenshot + metadata) when no results found */
  includeVisualFallback?: boolean;
  /** Include base64 screenshot in visual fallback response */
  includeBase64?: boolean;
}

export class UiAutomatorAdapter {
  constructor(private adb: AdbAdapter = new AdbAdapter()) {}

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
        const localPath = options.localPath || `/tmp/replicant-screenshot-${Date.now()}.png`;
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

  async findWithOcrFallback(
    deviceId: string,
    selector: {
      resourceId?: string;
      text?: string;
      textContains?: string;
      className?: string;
    },
    options: FindOptions = {}
  ): Promise<FindWithOcrResult> {
    // First try accessibility tree
    const accessibilityResults = await this.find(deviceId, selector);

    if (accessibilityResults.length > 0) {
      return {
        elements: accessibilityResults,
        source: "accessibility",
      };
    }

    // Fall back to OCR if we have a text-based selector
    if (selector.text || selector.textContains) {
      const searchTerm = selector.text || selector.textContains!;

      // Take screenshot for OCR
      const screenshotResult = await this.screenshot(deviceId, {});

      try {
        // Run OCR
        const ocrResults = await extractText(screenshotResult.path!);
        const matches = searchText(ocrResults, searchTerm);

        if (matches.length > 0) {
          const result: FindWithOcrResult = {
            elements: matches,
            source: "ocr",
          };

          if (options.debug) {
            result.fallbackReason = "accessibility tree had no matching text";
          }

          return result;
        }

        // OCR also found nothing - include visual fallback if requested
        if (options.includeVisualFallback) {
          const [screen, app] = await Promise.all([
            this.getScreenMetadata(deviceId),
            this.getCurrentApp(deviceId),
          ]);

          const result: FindWithOcrResult = {
            elements: [],
            source: "ocr",
            fallbackReason: options.debug ? "no matches in accessibility tree or OCR" : undefined,
            visualFallback: {
              screenshotPath: screenshotResult.path!,
              screen,
              app,
              hint: `No elements matched selector. Use screenshot to identify tap coordinates.`,
            },
          };

          if (options.includeBase64) {
            const base64Result = await this.adb.shell(deviceId, `base64 ${screenshotResult.path}`);
            result.visualFallback!.screenshotBase64 = base64Result.stdout.trim();
          }

          // Don't clean up screenshot since we're returning the path
          return result;
        }

        // No visual fallback requested
        const result: FindWithOcrResult = {
          elements: [],
          source: "ocr",
        };

        if (options.debug) {
          result.fallbackReason = "no matches in accessibility tree or OCR";
        }

        return result;
      } finally {
        // Clean up local screenshot file only if not returning visual fallback
        if (screenshotResult.path && !options.includeVisualFallback) {
          const fs = await import("fs/promises");
          await fs.unlink(screenshotResult.path).catch(() => {});
        }
      }
    }

    // No text selector, can't use OCR
    // Still include visual fallback if requested
    if (options.includeVisualFallback) {
      const snapshot = await this.visualSnapshot(deviceId, {
        includeBase64: options.includeBase64,
      });

      return {
        elements: [],
        source: "accessibility",
        visualFallback: {
          ...snapshot,
          hint: "No elements matched selector. Use screenshot to identify tap coordinates.",
        },
      };
    }

    return {
      elements: [],
      source: "accessibility",
    };
  }
}
