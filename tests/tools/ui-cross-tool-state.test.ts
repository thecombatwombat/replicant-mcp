import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";
import { handleUiActionTool } from "../../src/tools/ui-action.js";

describe("UI cross-tool state via ServerContext", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithFallbacks: vi.fn(),
        tap: vi.fn(),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
      lastFindResults: [],
    };
  });

  it("ui-query find populates lastFindResults, ui-action tap reads them", async () => {
    mockContext.ui.findWithFallbacks.mockResolvedValue({
      elements: [
        { text: "Submit", centerX: 300, centerY: 500, className: "Button", bounds: { left: 200, top: 450, right: 400, bottom: 550 }, clickable: true },
      ],
      source: "accessibility",
    });

    await handleUiQueryTool(
      { operation: "find", selector: { text: "Submit" } },
      mockContext
    );

    expect(mockContext.lastFindResults).toHaveLength(1);

    mockContext.ui.tap.mockResolvedValue(undefined);
    const tapResult = await handleUiActionTool(
      { operation: "tap", elementIndex: 0 },
      mockContext
    );

    expect(mockContext.ui.tap).toHaveBeenCalledWith("emulator-5554", 300, 500, undefined);
    expect(tapResult.tapped).toEqual({ x: 300, y: 500, deviceSpace: false });
  });

  it("ui-action tap fails when lastFindResults is empty", async () => {
    await expect(
      handleUiActionTool({ operation: "tap", elementIndex: 0 }, mockContext)
    ).rejects.toThrow("Element at index 0 not found");
  });
});
