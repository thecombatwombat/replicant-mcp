import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";
import { handleUiActionTool } from "../../src/tools/ui-action.js";

describe("UI cross-tool state via ServerContext", () => {
  let mockContext: any;

  // THE-112: ui-action's elementIndex path now re-dumps the tree to check
  // staleness. Tests that exercise the elementIndex path need to stub
  // ui.dump alongside ui.findWithFallbacks.
  const submitElement = {
    text: "Submit",
    resourceId: "btn_submit",
    centerX: 300,
    centerY: 500,
    className: "Button",
    bounds: { left: 200, top: 450, right: 400, bottom: 550 },
    clickable: true,
    focusable: true,
    contentDesc: "",
    index: 0,
  };

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
      lastFindResults: [],
      lastFindFingerprints: [],
    };
  });

  it("ui-query find populates lastFindResults, ui-action tap reads them", async () => {
    mockContext.ui.findWithFallbacks.mockResolvedValue({
      elements: [submitElement],
      source: "accessibility",
    });
    // Same tree on the re-dump = fingerprint matches = no STALE_ELEMENT_INDEX.
    mockContext.ui.dump.mockResolvedValue([submitElement]);

    await handleUiQueryTool(
      { operation: "find", selector: { text: "Submit" } },
      mockContext
    );

    expect(mockContext.lastFindResults).toHaveLength(1);
    expect(mockContext.lastFindFingerprints).toHaveLength(1);

    mockContext.ui.tap.mockResolvedValue(undefined);
    const tapResult = await handleUiActionTool(
      { operation: "tap", elementIndex: 0 },
      mockContext
    );

    expect(mockContext.ui.tap).toHaveBeenCalledWith("emulator-5554", 300, 500, true);
    expect(tapResult.tapped).toEqual({ x: 300, y: 500, deviceSpace: true });
  });

  it("ui-action tap fails when lastFindResults is empty", async () => {
    await expect(
      handleUiActionTool({ operation: "tap", elementIndex: 0 }, mockContext)
    ).rejects.toThrow("Element at index 0 not found");
  });
});
