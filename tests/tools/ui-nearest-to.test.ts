import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";
import { handleUiActionTool } from "../../src/tools/ui-action.js";

describe("UI Tool - nearestTo", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithFallbacks: vi.fn(),
        dump: vi.fn(),
        tap: vi.fn(),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };
  });

  describe("containment-based matching", () => {
    it("prioritizes elements whose container contains the anchor point", async () => {
      mockContext.ui.findWithFallbacks
        .mockResolvedValueOnce({
          elements: [
            { text: "Chobani", center: { x: 157, y: 836 }, bounds: "[87,822][226,850]", confidence: 0.91 },
          ],
          source: "ocr",
        })
        .mockResolvedValueOnce({
          elements: [
            { text: "", resourceId: "pin_overflow_action_id", className: "android.view.View", centerX: 498, centerY: 668, bounds: { left: 477, top: 647, right: 519, bottom: 689 }, clickable: true },
            { text: "", resourceId: "pin_overflow_action_id", className: "android.view.View", centerX: 498, centerY: 1682, bounds: { left: 477, top: 1661, right: 519, bottom: 1703 }, clickable: true },
          ],
          source: "accessibility",
          tier: 2,
          confidence: "high",
        });

      mockContext.ui.dump.mockResolvedValue([
        {
          className: "android.view.ViewGroup",
          bounds: { left: 10, top: 335, right: 535, bottom: 750 },
          centerX: 272, centerY: 542,
          children: [
            { resourceId: "pin_rep_id", bounds: { left: 10, top: 335, right: 535, bottom: 750 }, centerX: 272, centerY: 542 },
            { resourceId: "pin_overflow_action_id", bounds: { left: 477, top: 647, right: 519, bottom: 689 }, centerX: 498, centerY: 668 },
          ],
        },
        {
          className: "android.view.ViewGroup",
          bounds: { left: 10, top: 761, right: 535, bottom: 1839 },
          centerX: 272, centerY: 1300,
          children: [
            { resourceId: "pin_rep_id", bounds: { left: 10, top: 761, right: 535, bottom: 1839 }, centerX: 272, centerY: 1300 },
            { resourceId: "pin_overflow_action_id", bounds: { left: 477, top: 1661, right: 519, bottom: 1703 }, centerX: 498, centerY: 1682 },
          ],
        },
      ]);

      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "overflow menu", nearestTo: "Chobani" }, debug: true },
        mockContext
      );

      expect(result.elements[0].centerY).toBe(1682);
      expect(result.sortedByProximityTo).toEqual({
        query: "Chobani",
        anchor: { x: 157, y: 836 },
        method: "containment",
      });
    });

    it("falls back to distance sorting when no containment matches found", async () => {
      mockContext.ui.findWithFallbacks
        .mockResolvedValueOnce({
          elements: [
            { text: "SearchText", center: { x: 500, y: 500 }, bounds: "[450,475][550,525]", confidence: 0.9 },
          ],
          source: "ocr",
        })
        .mockResolvedValueOnce({
          elements: [
            { text: "", resourceId: "btn1", className: "Button", centerX: 100, centerY: 100, bounds: { left: 50, top: 50, right: 150, bottom: 150 }, clickable: true },
            { text: "", resourceId: "btn2", className: "Button", centerX: 600, centerY: 600, bounds: { left: 550, top: 550, right: 650, bottom: 650 }, clickable: true },
          ],
          source: "accessibility",
          tier: 2,
        });

      mockContext.ui.dump.mockResolvedValue([]);

      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "button", nearestTo: "SearchText" }, debug: true },
        mockContext
      );

      expect(result.elements[0].centerX).toBe(600);
      expect(result.sortedByProximityTo.method).toBe("distance");
    });
  });

  describe("anchor not found", () => {
    it("shows warning when anchor element cannot be found", async () => {
      mockContext.ui.findWithFallbacks
        .mockResolvedValueOnce({
          elements: [],
          source: "accessibility",
        })
        .mockResolvedValueOnce({
          elements: [
            { text: "", resourceId: "btn", className: "Button", centerX: 100, centerY: 100, bounds: { left: 50, top: 50, right: 150, bottom: 150 }, clickable: true },
          ],
          source: "accessibility",
          tier: 2,
        });

      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "button", nearestTo: "NonexistentText" } },
        mockContext
      );

      expect(result.nearestToWarning).toBe('Could not find anchor element: "NonexistentText"');
      expect(result.sortedByProximityTo).toBeUndefined();
    });
  });

  describe("tap after nearestTo find", () => {
    it("can tap the first element after nearestTo sorting", async () => {
      const btn = {
        text: "",
        resourceId: "btn",
        className: "Button",
        centerX: 200,
        centerY: 200,
        bounds: { left: 150, top: 150, right: 250, bottom: 250 },
        clickable: true,
      };
      mockContext.ui.findWithFallbacks
        .mockResolvedValueOnce({
          elements: [
            { text: "Anchor", center: { x: 100, y: 100 }, bounds: "[50,75][150,125]", confidence: 0.9 },
          ],
          source: "ocr",
        })
        .mockResolvedValueOnce({
          elements: [btn],
          source: "accessibility",
          tier: 2,
        });

      // Tree must contain the matched `btn` so the THE-112 stale-element
      // check can re-locate it at consume time. The containment scan during
      // find uses the same tree.
      mockContext.ui.dump.mockResolvedValue([
        {
          className: "android.view.ViewGroup",
          bounds: { left: 0, top: 0, right: 300, bottom: 300 },
          centerX: 150, centerY: 150,
          children: [btn],
        },
      ]);

      await handleUiQueryTool(
        { operation: "find", selector: { text: "button", nearestTo: "Anchor" } },
        mockContext
      );

      mockContext.ui.tap.mockResolvedValue(undefined);
      const tapResult = await handleUiActionTool(
        { operation: "tap", elementIndex: 0 },
        mockContext
      );

      expect(mockContext.ui.tap).toHaveBeenCalledWith("emulator-5554", 200, 200, true);
      expect(tapResult.tapped).toEqual({ x: 200, y: 200, deviceSpace: true });
    });
  });
});
