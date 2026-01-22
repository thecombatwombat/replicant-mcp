import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiTool } from "../../src/tools/ui.js";

describe("Icon Recognition Integration", () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Full fallback chain", () => {
    it("Tier 1 → returns accessibility match immediately", async () => {
      mockContext = {
        deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "device-1" }) },
        ui: {
          findWithFallbacks: vi.fn().mockResolvedValue({
            elements: [{ text: "Login", centerX: 540, centerY: 1200, className: "android.widget.Button" }],
            source: "accessibility",
            tier: 1,
            confidence: "high",
          }),
        },
        cache: { generateId: vi.fn(), set: vi.fn() },
      };

      const result = await handleUiTool(
        { operation: "find", selector: { text: "Login" }, debug: true },
        mockContext
      );

      expect(result.tier).toBe(1);
      expect(result.confidence).toBe("high");
    });

    it("Tier 2 → returns resourceId pattern match", async () => {
      mockContext = {
        deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "device-1" }) },
        ui: {
          findWithFallbacks: vi.fn().mockResolvedValue({
            elements: [{ resourceId: "com.example:id/overflow", centerX: 1024, centerY: 74, className: "android.widget.ImageButton" }],
            source: "accessibility",
            tier: 2,
            confidence: "high",
          }),
        },
        cache: { generateId: vi.fn(), set: vi.fn() },
      };

      const result = await handleUiTool(
        { operation: "find", selector: { text: "overflow menu" }, debug: true },
        mockContext
      );

      expect(result.tier).toBe(2);
    });

    it("Tier 4 → returns visual candidates", async () => {
      mockContext = {
        deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "device-1" }) },
        ui: {
          findWithFallbacks: vi.fn().mockResolvedValue({
            elements: [],
            source: "visual",
            tier: 4,
            confidence: "medium",
            candidates: [
              { index: 0, bounds: "[0,0][48,48]", center: { x: 24, y: 24 }, image: "base64..." },
            ],
          }),
        },
        cache: { generateId: vi.fn(), set: vi.fn() },
      };

      const result = await handleUiTool(
        { operation: "find", selector: { text: "some icon" }, debug: true },
        mockContext
      );

      expect(result.tier).toBe(4);
      expect(result.confidence).toBe("medium");
      expect(result.candidates).toBeDefined();
    });

    it("Tier 5 → returns grid for selection", async () => {
      mockContext = {
        deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "device-1" }) },
        ui: {
          findWithFallbacks: vi.fn().mockResolvedValue({
            elements: [],
            source: "grid",
            tier: 5,
            confidence: "low",
            gridImage: "base64grid...",
            gridPositions: ["Top-left", "Top-right", "Center", "Bottom-left", "Bottom-right"],
          }),
        },
        cache: { generateId: vi.fn(), set: vi.fn() },
      };

      const result = await handleUiTool(
        { operation: "find", selector: { text: "anything" }, debug: true },
        mockContext
      );

      expect(result.tier).toBe(5);
      expect(result.confidence).toBe("low");
      expect(result.gridImage).toBeDefined();
      expect(result.gridPositions).toHaveLength(5);
    });

    it("Tier 5 refinement → returns tap coordinates", async () => {
      mockContext = {
        deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "device-1" }) },
        ui: {
          findWithFallbacks: vi.fn().mockResolvedValue({
            elements: [{ index: 0, bounds: "[0,0][270,320]", center: { x: 135, y: 160 } }],
            source: "grid",
            tier: 5,
            confidence: "low",
          }),
        },
        cache: { generateId: vi.fn(), set: vi.fn() },
      };

      const result = await handleUiTool(
        {
          operation: "find",
          selector: { text: "anything" },
          gridCell: 1,
          gridPosition: 3,
        },
        mockContext
      );

      expect(result.tier).toBe(5);
      expect(result.count).toBe(1);
      expect((result.elements as any[])[0].center).toEqual({ x: 135, y: 160 });
    });
  });
});
