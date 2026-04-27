import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiActionTool } from "../../src/tools/ui-action.js";
import { ReplicantError, ErrorCode } from "../../src/types/index.js";

interface MockContext {
  deviceState: { ensureDevice: ReturnType<typeof vi.fn> };
  ui: {
    findWithFallbacks: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    dump: ReturnType<typeof vi.fn>;
    tap: ReturnType<typeof vi.fn>;
    input: ReturnType<typeof vi.fn>;
    scroll: ReturnType<typeof vi.fn>;
    visualSnapshot: ReturnType<typeof vi.fn>;
  };
  cache: { generateId: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  lastFindResults: unknown[];
  config: { getUiConfig: () => unknown };
}

function buildMockContext(): MockContext {
  return {
    deviceState: {
      ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
    },
    ui: {
      findWithFallbacks: vi.fn(),
      find: vi.fn(),
      dump: vi.fn(),
      tap: vi.fn().mockResolvedValue(undefined),
      input: vi.fn().mockResolvedValue(undefined),
      scroll: vi.fn().mockResolvedValue(undefined),
      visualSnapshot: vi.fn(),
    },
    cache: { generateId: vi.fn().mockReturnValue("test-id"), set: vi.fn() },
    lastFindResults: [],
    config: {
      getUiConfig: () => ({ autoFallbackScreenshot: false, includeBase64: false }),
    },
  };
}

describe("ui-action selector path (THE-99)", () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = buildMockContext();
  });

  describe("tap with selector", () => {
    it("taps the single match in device-space", async () => {
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [
          {
            text: "Connect", resourceId: "btn_connect", className: "android.widget.Button",
            centerX: 540, centerY: 1200, bounds: { left: 100, top: 1150, right: 980, bottom: 1250 },
            clickable: true, focusable: true, contentDesc: "", index: 0,
          },
        ],
        source: "accessibility",
      });

      const result = await handleUiActionTool(
        { operation: "tap", selector: { textContains: "Connect" } },
        ctx as any,
      );

      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 540, 1200, true);
      expect(result.tapped).toEqual({ x: 540, y: 1200, deviceSpace: true });
    });

    it("throws ELEMENT_NOT_FOUND when selector matches zero elements", async () => {
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({ elements: [], source: "accessibility" });

      await expect(
        handleUiActionTool(
          { operation: "tap", selector: { textContains: "Nonexistent" } },
          ctx as any,
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.ELEMENT_NOT_FOUND,
      });
      expect(ctx.ui.tap).not.toHaveBeenCalled();
    });

    it("throws AMBIGUOUS_MATCH when selector matches multiple elements", async () => {
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [
          { text: "Connect", resourceId: "btn_a", className: "Button", centerX: 100, centerY: 100, bounds: { left: 0, top: 0, right: 200, bottom: 200 }, clickable: true, focusable: true, contentDesc: "", index: 0 },
          { text: "Connect", resourceId: "btn_b", className: "Button", centerX: 300, centerY: 300, bounds: { left: 200, top: 200, right: 400, bottom: 400 }, clickable: true, focusable: true, contentDesc: "", index: 1 },
        ],
        source: "accessibility",
      });

      try {
        await handleUiActionTool(
          { operation: "tap", selector: { textContains: "Connect" } },
          ctx as any,
        );
        throw new Error("expected AMBIGUOUS_MATCH");
      } catch (err) {
        expect(err).toBeInstanceOf(ReplicantError);
        expect((err as ReplicantError).code).toBe(ErrorCode.AMBIGUOUS_MATCH);
        expect((err as ReplicantError).context?.buildResult).toBeDefined();
        const matches = (err as ReplicantError).context?.buildResult?.matches as unknown[];
        expect(matches).toHaveLength(2);
      }
      expect(ctx.ui.tap).not.toHaveBeenCalled();
    });

    it("falls through to coords when no selector is provided (back-compat)", async () => {
      const result = await handleUiActionTool(
        { operation: "tap", x: 100, y: 200 },
        ctx as any,
      );

      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 100, 200, true);
      expect(result.tapped).toEqual({ x: 100, y: 200, deviceSpace: true });
    });

    it("selector wins over elementIndex when both are provided", async () => {
      ctx.lastFindResults = [
        { centerX: 999, centerY: 999, className: "Button" } as never,
      ];
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [
          { text: "Submit", resourceId: "btn", className: "Button", centerX: 50, centerY: 60, bounds: { left: 0, top: 0, right: 100, bottom: 100 }, clickable: true, focusable: true, contentDesc: "", index: 0 },
        ],
        source: "accessibility",
      });

      await handleUiActionTool(
        { operation: "tap", selector: { textContains: "Submit" }, elementIndex: 0 },
        ctx as any,
      );

      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 50, 60, true);
    });
  });

  describe("input with selector", () => {
    it("focuses element via tap, then types", async () => {
      // resourceId-only selector → handleFind routes to handleSelectorFind → ui.find
      ctx.ui.find.mockResolvedValueOnce([
        { text: "", resourceId: "search_field", className: "EditText", centerX: 540, centerY: 200, bounds: { left: 100, top: 150, right: 980, bottom: 250 }, clickable: true, focusable: true, contentDesc: "", index: 0 },
      ]);

      await handleUiActionTool(
        { operation: "input", text: "hello world", selector: { resourceId: "search_field" } },
        ctx as any,
      );

      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 540, 200, true);
      expect(ctx.ui.input).toHaveBeenCalledWith("emulator-5554", "hello world");
    });

    it("returns AMBIGUOUS_MATCH on multiple matches", async () => {
      ctx.ui.find.mockResolvedValueOnce([
        { text: "", resourceId: "f1", className: "EditText", centerX: 1, centerY: 1, bounds: { left: 0, top: 0, right: 2, bottom: 2 }, clickable: true, focusable: true, contentDesc: "", index: 0 },
        { text: "", resourceId: "f2", className: "EditText", centerX: 3, centerY: 3, bounds: { left: 2, top: 2, right: 4, bottom: 4 }, clickable: true, focusable: true, contentDesc: "", index: 1 },
      ]);

      await expect(
        handleUiActionTool(
          { operation: "input", text: "x", selector: { className: "EditText" } },
          ctx as any,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.AMBIGUOUS_MATCH });
      expect(ctx.ui.input).not.toHaveBeenCalled();
    });

    it("requires text even when selector is provided", async () => {
      await expect(
        handleUiActionTool(
          { operation: "input", selector: { resourceId: "search_field" } },
          ctx as any,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.INPUT_VALIDATION_FAILED });
    });
  });

  describe("scroll with selector", () => {
    it("scrolls within the nearest scrollable ancestor's bounds", async () => {
      const list = {
        text: "", resourceId: "feed", className: "androidx.recyclerview.widget.RecyclerView",
        centerX: 540, centerY: 1100, bounds: { left: 0, top: 200, right: 1080, bottom: 2000 },
        clickable: false, focusable: false, contentDesc: "", index: 0,
        children: [
          {
            text: "Row 5", resourceId: "row", className: "android.widget.LinearLayout",
            centerX: 540, centerY: 900, bounds: { left: 0, top: 850, right: 1080, bottom: 950 },
            clickable: true, focusable: true, contentDesc: "", index: 0,
          },
        ],
      };
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [list.children![0]],
        source: "accessibility",
      });
      ctx.ui.dump.mockResolvedValueOnce([list]);

      const result = await handleUiActionTool(
        { operation: "scroll", direction: "down", selector: { textContains: "Row 5" } },
        ctx as any,
      );

      expect(ctx.ui.scroll).toHaveBeenCalledWith(
        "emulator-5554",
        "down",
        0.5,
        list.bounds,
      );
      expect((result.scrolled as Record<string, unknown>).container).toContain("RecyclerView");
    });

    it("falls back to screen-center scroll with a warning when no scrollable ancestor exists", async () => {
      const orphan = {
        text: "Lone", resourceId: "x", className: "android.widget.LinearLayout",
        centerX: 100, centerY: 100, bounds: { left: 0, top: 0, right: 200, bottom: 200 },
        clickable: true, focusable: true, contentDesc: "", index: 0,
      };
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({ elements: [orphan], source: "accessibility" });
      ctx.ui.dump.mockResolvedValueOnce([orphan]);

      const result = await handleUiActionTool(
        { operation: "scroll", direction: "up", selector: { textContains: "Lone" } },
        ctx as any,
      );

      expect(ctx.ui.scroll).toHaveBeenCalledWith("emulator-5554", "up", 0.5);
      expect(result.warning).toContain("scrollable");
    });
  });

  describe("back-compat: existing coord/elementIndex paths still work", () => {
    it("tap with x/y only (no selector)", async () => {
      const result = await handleUiActionTool(
        { operation: "tap", x: 540, y: 1800 },
        ctx as any,
      );
      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 540, 1800, true);
      expect(result.tapped).toEqual({ x: 540, y: 1800, deviceSpace: true });
    });

    it("scroll without selector hits screen center", async () => {
      const result = await handleUiActionTool(
        { operation: "scroll", direction: "down", amount: 0.7 },
        ctx as any,
      );
      expect(ctx.ui.scroll).toHaveBeenCalledWith("emulator-5554", "down", 0.7);
      expect(result.scrolled).toEqual({ direction: "down", amount: 0.7 });
    });
  });
});
