import * as path from "path";
import * as os from "os";
import sharp from "sharp";
import { AdbAdapter } from "./adb.js";
import { parseUiDump, findElements, flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";
import { ReplicantError, ErrorCode, VisualSnapshot } from "../types/index.js";
import {
  FindWithFallbacksResult,
  FindOptions,
} from "../types/icon-recognition.js";
import { calculateScaleFactor, toImageSpace, toDeviceSpace, boundsToImageSpace } from "../services/scaling.js";
import { getDefaultScreenshotPath } from "../utils/paths.js";
import { findWithFallbacks } from "./ui-fallback-find.js";

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
  maxDimension?: number;
  raw?: boolean;
}

export interface ScreenshotResult {
  mode: "file" | "inline";
  path?: string;
  base64?: string;
  mimeType?: string;
  sizeBytes?: number;
  device?: { width: number; height: number };
  image?: { width: number; height: number };
  scaleFactor?: number;
  warning?: string;
}


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

export class UiAutomatorAdapter {
  private scalingState: ScalingState | null = null;

  constructor(private adb: AdbAdapter = new AdbAdapter()) {}

  // Getter for tests
  getScalingState(): ScalingState | null {
    return this.scalingState;
  }

  /**
   * Transforms accessibility tree nodes from device space to image space.
   * This ensures bounds/coordinates match the scaled screenshot when scaling is active.
   */
  private transformTreeToImageSpace(nodes: AccessibilityNode[]): AccessibilityNode[] {
    if (!this.scalingState || this.scalingState.scaleFactor === 1.0) {
      return nodes;
    }
    const sf = this.scalingState.scaleFactor;
    return nodes.map((node) => {
      const newBounds = boundsToImageSpace(node.bounds, sf);
      const center = toImageSpace(node.centerX, node.centerY, sf);
      return {
        ...node,
        bounds: newBounds,
        centerX: center.x,
        centerY: center.y,
        children: node.children ? this.transformTreeToImageSpace(node.children) : [],
      };
    });
  }

  async dump(deviceId: string): Promise<AccessibilityNode[]> {
    // Dump UI hierarchy to device
    await this.adb.shell(deviceId, "uiautomator dump /sdcard/ui-dump.xml");

    // Pull the dump
    const result = await this.adb.shell(deviceId, "cat /sdcard/ui-dump.xml");

    // Clean up
    await this.adb.shell(deviceId, "rm /sdcard/ui-dump.xml");

    const tree = parseUiDump(result.stdout);
    return this.transformTreeToImageSpace(tree);
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

  async tap(deviceId: string, x: number, y: number, deviceSpace?: boolean): Promise<void> {
    // Convert from image space to device space if scaling is active
    // Skip conversion if deviceSpace=true (coordinates are already in device space)
    let tapX = x;
    let tapY = y;
    if (!deviceSpace && this.scalingState && this.scalingState.scaleFactor !== 1.0) {
      const converted = toDeviceSpace(x, y, this.scalingState.scaleFactor);
      tapX = converted.x;
      tapY = converted.y;
    }
    await this.adb.shell(deviceId, `input tap ${tapX} ${tapY}`);
  }

  async tapElement(deviceId: string, element: AccessibilityNode): Promise<void> {
    await this.tap(deviceId, element.centerX, element.centerY);
  }

  async input(deviceId: string, text: string): Promise<void> {
    // Escape special characters for shell
    const escaped = text.replace(/(['"\\$`])/g, "\\$1").replace(/ /g, "%s");
    await this.adb.shell(deviceId, `input text "${escaped}"`);
  }

  async scroll(
    deviceId: string,
    direction: "up" | "down" | "left" | "right",
    amount: number = 0.5
  ): Promise<void> {
    const screen = await this.getScreenMetadata(deviceId);
    const { width, height } = screen;

    // Calculate scroll distance based on amount (0-1 representing screen percentage)
    const scrollDistance = Math.round(
      (direction === "up" || direction === "down" ? height : width) * amount * 0.8
    );

    // Center point of the screen
    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);

    // Calculate start and end points based on direction
    // Note: "scroll down" means content moves up, so we swipe up (finger moves from bottom to top)
    let startX: number, startY: number, endX: number, endY: number;
    switch (direction) {
      case "down": // Scroll down = swipe up = finger moves up
        startX = centerX;
        startY = centerY + scrollDistance / 2;
        endX = centerX;
        endY = centerY - scrollDistance / 2;
        break;
      case "up": // Scroll up = swipe down = finger moves down
        startX = centerX;
        startY = centerY - scrollDistance / 2;
        endX = centerX;
        endY = centerY + scrollDistance / 2;
        break;
      case "right": // Scroll right = swipe left = finger moves left
        startX = centerX + scrollDistance / 2;
        startY = centerY;
        endX = centerX - scrollDistance / 2;
        endY = centerY;
        break;
      case "left": // Scroll left = swipe right = finger moves right
        startX = centerX - scrollDistance / 2;
        startY = centerY;
        endX = centerX + scrollDistance / 2;
        endY = centerY;
        break;
    }

    // Duration in ms - longer for larger scrolls, minimum 100ms
    const duration = Math.max(100, Math.round(scrollDistance / 2));
    await this.adb.shell(deviceId, `input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`);
  }

  async screenshot(deviceId: string, options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const remotePath = "/sdcard/replicant-screenshot.png";
    const maxDimension = options.maxDimension ?? 800;

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
        // Inline mode: pull to temp, scale, convert to JPEG, return base64
        const tempPath = path.join(os.tmpdir(), `replicant-inline-${Date.now()}.png`);

        try {
          // Pull to temp file
          await this.adb.pull(deviceId, remotePath, tempPath);

          // Get dimensions
          const metadata = await sharp(tempPath).metadata();
          const deviceWidth = metadata.width!;
          const deviceHeight = metadata.height!;

          // Calculate scale factor
          const scaleFactor = calculateScaleFactor(deviceWidth, deviceHeight, maxDimension);
          const imageWidth = Math.round(deviceWidth / scaleFactor);
          const imageHeight = Math.round(deviceHeight / scaleFactor);

          // Sharpen, scale, convert to WebP, strip ICC profile
          const buffer = await sharp(tempPath)
            .sharpen({ sigma: 0.5 })
            .resize(imageWidth, imageHeight)
            .webp({ quality: 72, effort: 5, smartSubsample: true })
            .withMetadata({})
            .toBuffer();

          // Update scaling state (now supported for inline!)
          this.scalingState = {
            scaleFactor,
            deviceWidth,
            deviceHeight,
            imageWidth,
            imageHeight,
          };

          return {
            mode: "inline",
            base64: buffer.toString("base64"),
            mimeType: "image/webp",
            sizeBytes: buffer.length,
            device: { width: deviceWidth, height: deviceHeight },
            image: { width: imageWidth, height: imageHeight },
            scaleFactor,
          };
        } finally {
          // Clean up temp file
          const fsPromises = await import("fs/promises");
          await fsPromises.unlink(tempPath).catch(() => {});
        }
      } else {
        // File mode: pull to local, then optionally scale
        const localPath = options.localPath || getDefaultScreenshotPath();
        await this.adb.pull(deviceId, remotePath, localPath);

        // Get image dimensions
        const metadata = await sharp(localPath).metadata();
        const deviceWidth = metadata.width!;
        const deviceHeight = metadata.height!;

        // Handle raw mode
        if (options.raw) {
          this.scalingState = {
            scaleFactor: 1.0,
            deviceWidth,
            deviceHeight,
            imageWidth: deviceWidth,
            imageHeight: deviceHeight,
          };
          return {
            mode: "file",
            path: localPath,
            device: { width: deviceWidth, height: deviceHeight },
            image: { width: deviceWidth, height: deviceHeight },
            scaleFactor: 1.0,
            warning: "Raw mode: no scaling applied. May exceed API limits with multiple images.",
          };
        }

        // Calculate scale factor
        const scaleFactor = calculateScaleFactor(deviceWidth, deviceHeight, maxDimension);

        if (scaleFactor === 1.0) {
          // No scaling needed
          this.scalingState = {
            scaleFactor: 1.0,
            deviceWidth,
            deviceHeight,
            imageWidth: deviceWidth,
            imageHeight: deviceHeight,
          };
          return {
            mode: "file",
            path: localPath,
            device: { width: deviceWidth, height: deviceHeight },
            image: { width: deviceWidth, height: deviceHeight },
            scaleFactor: 1.0,
          };
        }

        // Scale the image
        const imageWidth = Math.round(deviceWidth / scaleFactor);
        const imageHeight = Math.round(deviceHeight / scaleFactor);

        await sharp(localPath)
          .resize(imageWidth, imageHeight)
          .toFile(localPath + ".tmp");

        // Replace original with scaled version
        const fsPromises = await import("fs/promises");
        await fsPromises.rename(localPath + ".tmp", localPath);

        // Update scaling state
        this.scalingState = {
          scaleFactor,
          deviceWidth,
          deviceHeight,
          imageWidth,
          imageHeight,
        };

        return {
          mode: "file",
          path: localPath,
          device: { width: deviceWidth, height: deviceHeight },
          image: { width: imageWidth, height: imageHeight },
          scaleFactor,
        };
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
    return findWithFallbacks(
      {
        find: (id, sel) => this.find(id, sel),
        dump: (id) => this.dump(id),
        screenshot: (id, opts) => this.screenshot(id, opts),
        getScreenMetadata: (id) => this.getScreenMetadata(id),
        visualSnapshot: (id, opts) => this.visualSnapshot(id, opts),
        getScalingState: () => this.getScalingState(),
      },
      deviceId,
      selector,
      options
    );
  }

}
