import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";
import { handleUiCaptureTool } from "../../src/tools/ui-capture.js";

describe("UI Tool - Token Efficient Defaults", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        dump: vi.fn(),
        screenshot: vi.fn(),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("ui-dump-1"),
        set: vi.fn(),
      },
      lastFindResults: [],
    };
  });

  it("uses compact dump output by default", async () => {
    mockContext.ui.dump.mockResolvedValue([
      {
        className: "android.widget.Button",
        text: "Continue",
        contentDesc: "",
        resourceId: "com.example:id/continue",
        bounds: { left: 100, top: 200, right: 300, bottom: 260 },
        centerX: 200,
        centerY: 230,
        clickable: true,
        focusable: true,
        index: 0,
        children: [],
      },
    ]);

    const result = await handleUiQueryTool({ operation: "dump" }, mockContext);

    expect(result).toMatchObject({
      elements: expect.any(Array),
      count: 1,
      totalCount: 1,
    });
    expect((result as Record<string, unknown>).tree).toBeUndefined();
  });

  it("uses non-inline screenshot mode by default", async () => {
    mockContext.ui.screenshot.mockResolvedValue({
      mode: "file",
      path: ".replicant/screenshots/screenshot.png",
      image: { width: 450, height: 800 },
      scaleFactor: 2.4,
    });

    await handleUiCaptureTool({ operation: "screenshot" }, mockContext);

    expect(mockContext.ui.screenshot).toHaveBeenCalledWith(
      "emulator-5554",
      expect.objectContaining({ inline: false }),
    );
  });
});
