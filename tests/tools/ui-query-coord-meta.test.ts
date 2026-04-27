import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";

describe("ui-query dump coordinate metadata (THE-96)", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        dump: vi.fn().mockResolvedValue([
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
        ]),
        getScalingState: vi.fn(),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("ui-dump-1"),
        set: vi.fn(),
      },
      lastFindResults: [],
    };
  });

  it("compact dump tags coords as device-space with scaleFactor 1.0 when no screenshot has been taken", async () => {
    mockContext.ui.getScalingState.mockReturnValue(null);

    const result = await handleUiQueryTool({ operation: "dump" }, mockContext);

    expect(result.coordinateSpace).toBe("device");
    expect(result.scaleFactor).toBe(1.0);
    expect(result.deviceDimensions).toBeUndefined();
    expect(result.imageDimensions).toBeUndefined();
  });

  it("compact dump exposes scaleFactor + dimensions when scaling state is active", async () => {
    mockContext.ui.getScalingState.mockReturnValue({
      scaleFactor: 3.03,
      deviceWidth: 1080,
      deviceHeight: 2424,
      imageWidth: 356,
      imageHeight: 800,
    });

    const result = await handleUiQueryTool({ operation: "dump" }, mockContext);

    expect(result.coordinateSpace).toBe("device");
    expect(result.scaleFactor).toBe(3.03);
    expect(result.deviceDimensions).toEqual({ width: 1080, height: 2424 });
    expect(result.imageDimensions).toEqual({ width: 356, height: 800 });
  });

  it("full-tree dump carries the same coordinate metadata", async () => {
    mockContext.ui.getScalingState.mockReturnValue({
      scaleFactor: 2.0,
      deviceWidth: 1080,
      deviceHeight: 2400,
      imageWidth: 540,
      imageHeight: 1200,
    });

    const result = await handleUiQueryTool({ operation: "dump", compact: false }, mockContext);

    expect(result.coordinateSpace).toBe("device");
    expect(result.scaleFactor).toBe(2.0);
    expect(result.deviceDimensions).toEqual({ width: 1080, height: 2400 });
    expect(result.imageDimensions).toEqual({ width: 540, height: 1200 });
    expect(result.tree).toBeDefined();
  });
});
