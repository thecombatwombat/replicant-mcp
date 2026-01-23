import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiTool } from "../../src/tools/ui.js";

// This test simulates the Chobani scenario end-to-end with mocked dependencies

describe("OCR Fallback Integration", () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds Chobani ad via OCR when accessibility tree has no text", async () => {
    // Simulate Pinterest-like scenario where accessibility tree has elements but no text
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithFallbacks: vi.fn().mockResolvedValue({
          elements: [
            {
              index: 0,
              text: "Chobani High Protein Drinks & Cups",
              bounds: "[10,761][535,1200]",
              center: { x: 272, y: 980 },
              confidence: 0.92,
            },
          ],
          source: "ocr",
          fallbackReason: "accessibility tree had no matching text",
        }),
        tap: vi.fn().mockResolvedValue(undefined),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };

    // Step 1: Find the Chobani ad
    const findResult = await handleUiTool(
      { operation: "find", selector: { text: "Chobani" }, debug: true },
      mockContext
    );

    expect(findResult.count).toBe(1);
    expect(findResult.source).toBe("ocr");
    expect((findResult.elements as any[])[0].text).toContain("Chobani");

    // Step 2: Tap on the found element
    const tapResult = await handleUiTool(
      { operation: "tap", elementIndex: 0 },
      mockContext
    );

    expect(mockContext.ui.tap).toHaveBeenCalledWith("emulator-5554", 272, 980, undefined);
    expect(tapResult.tapped).toEqual({ x: 272, y: 980, deviceSpace: false });
  });

  it("prefers accessibility results over OCR when available", async () => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithFallbacks: vi.fn().mockResolvedValue({
          elements: [
            {
              text: "Login",
              centerX: 540,
              centerY: 1200,
              bounds: { left: 100, top: 1150, right: 980, bottom: 1250 },
              clickable: true,
              resourceId: "com.example:id/login_btn",
              className: "android.widget.Button",
            },
          ],
          source: "accessibility",
        }),
        tap: vi.fn().mockResolvedValue(undefined),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };

    const findResult = await handleUiTool(
      { operation: "find", selector: { text: "Login" }, debug: true },
      mockContext
    );

    expect(findResult.count).toBe(1);
    expect(findResult.source).toBe("accessibility");
    expect((findResult.elements as any[])[0].clickable).toBe(true);
  });

  it("handles multiple OCR matches", async () => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithFallbacks: vi.fn().mockResolvedValue({
          elements: [
            {
              index: 0,
              text: "Product 1",
              bounds: "[10,100][200,150]",
              center: { x: 105, y: 125 },
              confidence: 0.95,
            },
            {
              index: 1,
              text: "Product 2",
              bounds: "[10,200][200,250]",
              center: { x: 105, y: 225 },
              confidence: 0.88,
            },
          ],
          source: "ocr",
        }),
        tap: vi.fn().mockResolvedValue(undefined),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };

    const findResult = await handleUiTool(
      { operation: "find", selector: { textContains: "Product" } },
      mockContext
    );

    expect(findResult.count).toBe(2);
    expect((findResult.elements as any[])[0].text).toBe("Product 1");
    expect((findResult.elements as any[])[1].text).toBe("Product 2");
  });

  it("returns empty when both accessibility and OCR find nothing", async () => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithFallbacks: vi.fn().mockResolvedValue({
          elements: [],
          source: "ocr",
        }),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };

    const findResult = await handleUiTool(
      { operation: "find", selector: { text: "NonExistent" } },
      mockContext
    );

    expect(findResult.count).toBe(0);
    expect((findResult.elements as any[]).length).toBe(0);
  });
});
