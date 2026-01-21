import { AdbAdapter } from "./adb.js";
import { parseUiDump, findElements, flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";
import { ReplicantError, ErrorCode, OcrElement } from "../types/index.js";
import { extractText, searchText } from "../services/ocr.js";

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
}

export interface FindOptions {
  debug?: boolean;
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

        const result: FindWithOcrResult = {
          elements: matches,
          source: "ocr",
        };

        if (options.debug) {
          result.fallbackReason = "accessibility tree had no matching text";
        }

        return result;
      } finally {
        // Clean up local screenshot file
        if (screenshotResult.path) {
          const fs = await import("fs/promises");
          await fs.unlink(screenshotResult.path).catch(() => {});
        }
      }
    }

    // No text selector, can't use OCR
    return {
      elements: [],
      source: "accessibility",
    };
  }
}
