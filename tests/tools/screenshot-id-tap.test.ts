// Tests for THE-111: screenshotId-tied image-space tap on ui-action.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiActionTool } from "../../src/tools/ui-action.js";
import { handleUiCaptureTool } from "../../src/tools/ui-capture.js";
import { CacheManager } from "../../src/services/cache-manager.js";

describe("ui-action tap via screenshotId (THE-111)", () => {
  let ctx: any;
  const cfg = { autoFallbackScreenshot: false, includeBase64: false, maxImageDimension: 800 };

  beforeEach(() => {
    const cache = new CacheManager();
    ctx = {
      deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }) },
      ui: {
        screenshot: vi.fn().mockResolvedValue({
          mode: "file",
          path: "/tmp/x.png",
          device: { width: 1080, height: 2400 },
          image: { width: 360, height: 800 },
          scaleFactor: 3,
        }),
        tap: vi.fn().mockResolvedValue(undefined),
        getCurrentApp: vi.fn().mockResolvedValue(null),
      },
      cache,
      lastFindResults: [],
    };
  });

  it("screenshot response includes a screenshotId", async () => {
    const result: any = await handleUiCaptureTool({ operation: "screenshot" }, ctx, cfg);
    expect(typeof result.screenshotId).toBe("string");
    expect(result.screenshotId.length).toBeGreaterThan(0);
  });

  it("tap with screenshotId+imageX+imageY converts to device coords using THAT screenshot's scaling", async () => {
    const cap: any = await handleUiCaptureTool({ operation: "screenshot" }, ctx, cfg);
    const sid = cap.screenshotId;

    // Image-space (100, 200) at scaleFactor 3 -> device-space (300, 600).
    const result: any = await handleUiActionTool(
      { operation: "tap", screenshotId: sid, imageX: 100, imageY: 200 },
      ctx,
      cfg,
    );

    expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 300, 600, true);
    expect(result.viaScreenshotId).toBe(sid);
    expect(result.imageCoords).toEqual({ x: 100, y: 200 });
  });

  it("unknown screenshotId throws UNKNOWN_SCREENSHOT_ID", async () => {
    await expect(
      handleUiActionTool(
        { operation: "tap", screenshotId: "screenshot-deadbeef-0", imageX: 1, imageY: 1 },
        ctx,
        cfg,
      ),
    ).rejects.toThrow(/UNKNOWN_SCREENSHOT_ID|unknown or has expired/);
  });

  it("expired screenshotId throws UNKNOWN_SCREENSHOT_ID (TTL-checked at lookup time)", async () => {
    const cap: any = await handleUiCaptureTool({ operation: "screenshot" }, ctx, cfg);
    const sid = cap.screenshotId;
    // Manually expire the entry.
    (ctx.cache as CacheManager).clear(sid);
    await expect(
      handleUiActionTool(
        { operation: "tap", screenshotId: sid, imageX: 1, imageY: 1 },
        ctx,
        cfg,
      ),
    ).rejects.toThrow(/UNKNOWN_SCREENSHOT_ID|unknown or has expired/);
  });

  it("screenshotId without imageX/imageY rejects with INPUT_VALIDATION_FAILED", async () => {
    const cap: any = await handleUiCaptureTool({ operation: "screenshot" }, ctx, cfg);
    const sid = cap.screenshotId;
    await expect(
      handleUiActionTool({ operation: "tap", screenshotId: sid }, ctx, cfg),
    ).rejects.toThrow(/imageX and imageY/);
  });

  it("omits screenshotId when adapter doesn't supply scaling metadata (CU-7 follow-up)", async () => {
    // ScreenshotResult types scaleFactor/device/image as optional. When an
    // adapter or partial mock omits them, we must not hand the caller a
    // screenshotId that will throw UNKNOWN_SCREENSHOT_ID on use — the cache
    // entry would never have been populated.
    ctx.ui.screenshot.mockResolvedValueOnce({
      mode: "file",
      path: "/tmp/no-scaling.png",
    });
    const result: any = await handleUiCaptureTool({ operation: "screenshot" }, ctx, cfg);
    expect(result.screenshotId).toBeUndefined();
  });

  it("does not break the existing direct device-coord tap path", async () => {
    const result: any = await handleUiActionTool(
      { operation: "tap", x: 100, y: 200 },
      ctx,
      cfg,
    );
    expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 100, 200, true);
    expect(result.viaScreenshotId).toBeUndefined();
  });
});
