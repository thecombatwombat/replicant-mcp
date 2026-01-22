import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiTool } from "../../src/tools/ui.js";

describe("UI Tool - OCR Fallback", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithOcrFallback: vi.fn(),
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
    it("uses findWithOcrFallback for text selectors", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [
          { text: "Login", centerX: 200, centerY: 300, bounds: { left: 100, top: 250, right: 300, bottom: 350 }, clickable: true },
        ],
        source: "accessibility",
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "Login" } },
        mockContext
      );

      expect(mockContext.ui.findWithOcrFallback).toHaveBeenCalledWith(
        "emulator-5554",
        { text: "Login" },
        { debug: false, includeVisualFallback: true, includeBase64: false }
      );
      expect(result.count).toBe(1);
    });

    it("includes source in response when debug=true", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [
          { index: 0, text: "Chobani", bounds: "[10,100][200,150]", center: { x: 105, y: 125 }, confidence: 0.92 },
        ],
        source: "ocr",
        fallbackReason: "accessibility tree had no matching text",
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "Chobani" }, debug: true },
        mockContext
      );

      expect(result.source).toBe("ocr");
      expect(result.fallbackReason).toBe("accessibility tree had no matching text");
    });

    it("does not include source when debug=false", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [],
        source: "ocr",
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "NotFound" } },
        mockContext
      );

      expect(result.source).toBeUndefined();
    });

    it("stores OCR elements in lastFindResults for tapping", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [
          { index: 0, text: "Chobani", bounds: "[10,100][200,150]", center: { x: 105, y: 125 }, confidence: 0.92 },
        ],
        source: "ocr",
      });

      await handleUiTool(
        { operation: "find", selector: { text: "Chobani" } },
        mockContext
      );

      // Now tap should work
      mockContext.ui.tap.mockResolvedValue(undefined);

      const tapResult = await handleUiTool(
        { operation: "tap", elementIndex: 0 },
        mockContext
      );

      expect(mockContext.ui.tap).toHaveBeenCalledWith("emulator-5554", 105, 125);
    });

    it("uses regular find for non-text selectors", async () => {
      mockContext.ui.find.mockResolvedValue([
        { text: "", resourceId: "com.example:id/btn", className: "Button", centerX: 100, centerY: 100, bounds: { left: 50, top: 50, right: 150, bottom: 150 }, clickable: true },
      ]);

      const result = await handleUiTool(
        { operation: "find", selector: { resourceId: "btn" } },
        mockContext
      );

      expect(mockContext.ui.find).toHaveBeenCalled();
      expect(mockContext.ui.findWithOcrFallback).not.toHaveBeenCalled();
      expect(result.count).toBe(1);
    });
  });
});
