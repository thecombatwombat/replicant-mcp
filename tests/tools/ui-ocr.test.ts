import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";
import { handleUiActionTool } from "../../src/tools/ui-action.js";

describe("UI Tool - OCR Fallback", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithFallbacks: vi.fn(),
        tap: vi.fn(),
        find: vi.fn(),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };
  });

  describe("find operation with OCR fallback", () => {
    it("uses findWithFallbacks for text selectors", async () => {
      mockContext.ui.findWithFallbacks.mockResolvedValue({
        elements: [
          { text: "Login", centerX: 200, centerY: 300, bounds: { left: 100, top: 250, right: 300, bottom: 350 }, clickable: true },
        ],
        source: "accessibility",
      });

      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "Login" } },
        mockContext
      );

      expect(mockContext.ui.findWithFallbacks).toHaveBeenCalledWith(
        "emulator-5554",
        { text: "Login" },
        { debug: false, includeVisualFallback: true, includeBase64: false }
      );
      expect(result.count).toBe(1);
    });

    it("includes source in response when debug=true", async () => {
      mockContext.ui.findWithFallbacks.mockResolvedValue({
        elements: [
          { index: 0, text: "Chobani", bounds: "[10,100][200,150]", center: { x: 105, y: 125 }, confidence: 0.92 },
        ],
        source: "ocr",
        fallbackReason: "accessibility tree had no matching text",
      });

      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "Chobani" }, debug: true },
        mockContext
      );

      expect(result.source).toBe("ocr");
      expect(result.fallbackReason).toBe("accessibility tree had no matching text");
    });

    it("does not include source when debug=false", async () => {
      mockContext.ui.findWithFallbacks.mockResolvedValue({
        elements: [],
        source: "ocr",
      });

      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "NotFound" } },
        mockContext
      );

      expect(result.source).toBeUndefined();
    });

    it("passes maxTier to findWithFallbacks for early-stop control", async () => {
      mockContext.ui.findWithFallbacks.mockResolvedValue({
        elements: [],
        source: "ocr",
        tier: 3,
        confidence: "low",
        stoppedEarly: true,
        stoppedAtTier: 3,
        nextTierAvailable: 4,
        stopReason: "maxTier limit reached",
      });

      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "NotFound" }, maxTier: 3 },
        mockContext
      );

      expect(mockContext.ui.findWithFallbacks).toHaveBeenCalledWith(
        "emulator-5554",
        { text: "NotFound" },
        { debug: false, includeVisualFallback: true, includeBase64: false, maxTier: 3 }
      );
      expect(result.stoppedEarly).toBe(true);
      expect(result.stoppedAtTier).toBe(3);
      expect(result.nextTierAvailable).toBe(4);
      expect(result.stopReason).toBe("maxTier limit reached");
    });

    it("stores OCR elements in lastFindResults for tapping", async () => {
      mockContext.ui.findWithFallbacks.mockResolvedValue({
        elements: [
          { index: 0, text: "Chobani", bounds: "[10,100][200,150]", center: { x: 105, y: 125 }, confidence: 0.92 },
        ],
        source: "ocr",
      });

      await handleUiQueryTool(
        { operation: "find", selector: { text: "Chobani" } },
        mockContext
      );

      // Now tap should work via ui-action
      mockContext.ui.tap.mockResolvedValue(undefined);

      await handleUiActionTool(
        { operation: "tap", elementIndex: 0 },
        mockContext
      );

      expect(mockContext.ui.tap).toHaveBeenCalledWith("emulator-5554", 105, 125, true);
    });

    it("uses regular find for non-text selectors", async () => {
      mockContext.ui.find.mockResolvedValue([
        { text: "", resourceId: "com.example:id/btn", className: "Button", centerX: 100, centerY: 100, bounds: { left: 50, top: 50, right: 150, bottom: 150 }, clickable: true },
      ]);

      const result = await handleUiQueryTool(
        { operation: "find", selector: { resourceId: "btn" } },
        mockContext
      );

      expect(mockContext.ui.find).toHaveBeenCalled();
      expect(mockContext.ui.findWithFallbacks).not.toHaveBeenCalled();
      expect(result.count).toBe(1);
    });
  });
});
