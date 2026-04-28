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

    it("picks the nearest match (matches[0]) when nearestTo disambiguates multiple results", async () => {
      // findWithFallbacks already runs the proximity sort, so the first element
      // is the intended target. Selector path should accept it instead of
      // throwing AMBIGUOUS_MATCH (the whole point of nearestTo).
      // First call: anchor lookup for "Aditya".
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [
          { text: "Aditya", resourceId: "anchor", className: "TextView", centerX: 500, centerY: 700, bounds: { left: 0, top: 650, right: 1000, bottom: 750 }, clickable: false, focusable: false, contentDesc: "", index: 0 },
        ],
        source: "accessibility",
      });
      // Second call: actual "Connect" lookup.
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [
          { text: "Connect", resourceId: "near", className: "Button", centerX: 500, centerY: 800, bounds: { left: 0, top: 750, right: 1000, bottom: 850 }, clickable: true, focusable: true, contentDesc: "", index: 0 },
          { text: "Connect", resourceId: "far",  className: "Button", centerX: 500, centerY: 1500, bounds: { left: 0, top: 1450, right: 1000, bottom: 1550 }, clickable: true, focusable: true, contentDesc: "", index: 1 },
        ],
        source: "accessibility",
      });
      // dump for containment scoring
      ctx.ui.dump.mockResolvedValueOnce([]);

      const result = await handleUiActionTool(
        { operation: "tap", selector: { textContains: "Connect", nearestTo: "Aditya" } },
        ctx as any,
      );

      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 500, 800, true);
      expect(result.tapped).toEqual({ x: 500, y: 800, deviceSpace: true });
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

    it("preserves fallback candidates in ELEMENT_NOT_FOUND so the caller doesn't pay for the work twice", async () => {
      // Tier 4 visual fallback: 0 elements but a candidate list.
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [],
        source: "visual",
        tier: 4,
        candidates: [
          { index: 0, bounds: "[0,0][100,100]", center: { x: 50, y: 50 }, image: "data:image/png;base64,AAAA" },
          { index: 1, bounds: "[100,0][200,100]", center: { x: 150, y: 50 }, image: "data:image/png;base64,BBBB" },
        ],
      });

      try {
        await handleUiActionTool(
          { operation: "tap", selector: { textContains: "Connect" } },
          ctx as any,
        );
        throw new Error("expected ELEMENT_NOT_FOUND");
      } catch (err) {
        const e = err as ReplicantError;
        expect(e.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
        const candidates = e.context?.buildResult?.candidates as unknown[];
        expect(candidates).toHaveLength(2);
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

    it("ignores explicit deviceSpace=false when coords come from a selector (always device-space)", async () => {
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [
          {
            text: "Connect", resourceId: "btn", className: "Button",
            centerX: 540, centerY: 1200, bounds: { left: 0, top: 1150, right: 1080, bottom: 1250 },
            clickable: true, focusable: true, contentDesc: "", index: 0,
          },
        ],
        source: "accessibility",
      });

      const result = await handleUiActionTool(
        { operation: "tap", selector: { textContains: "Connect" }, deviceSpace: false },
        ctx as any,
      );

      // Even though caller passed deviceSpace:false, selector-resolved coords are
      // always device-space and must NOT be re-converted.
      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 540, 1200, true);
      expect(result.tapped).toEqual({ x: 540, y: 1200, deviceSpace: true });
    });

    it("ignores explicit deviceSpace=false when coords come from elementIndex", async () => {
      ctx.lastFindResults = [
        {
          centerX: 100, centerY: 200, className: "Button",
          text: "x", resourceId: "y", bounds: { left: 0, top: 0, right: 200, bottom: 400 },
          clickable: true, focusable: true, contentDesc: "", index: 0,
        } as never,
      ];

      await handleUiActionTool(
        { operation: "tap", elementIndex: 0, deviceSpace: false },
        ctx as any,
      );

      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 100, 200, true);
    });

    it("respects explicit deviceSpace=false on the raw x/y path", async () => {
      await handleUiActionTool(
        { operation: "tap", x: 178, y: 68, deviceSpace: false },
        ctx as any,
      );

      // Raw coord path: caller knows what space they're in. Honor the flag.
      expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 178, 68, false);
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
    const scrollTree = (className: string, scrollable?: boolean) => ({
      text: "", resourceId: "container", className,
      centerX: 540, centerY: 1100, bounds: { left: 0, top: 200, right: 1080, bottom: 2000 },
      clickable: false, focusable: false, contentDesc: "", index: 0,
      ...(scrollable === undefined ? {} : { scrollable }),
      children: [
        {
          text: "Target", resourceId: "row", className: "android.widget.TextView",
          centerX: 540, centerY: 900, bounds: { left: 0, top: 850, right: 1080, bottom: 950 },
          clickable: true, focusable: true, contentDesc: "", index: 0,
        },
      ],
    });

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

    it("uses semantic scrollable=true on a generic container", async () => {
      const tree = scrollTree("android.view.ViewGroup", true);
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [tree.children[0]],
        source: "accessibility",
      });
      ctx.ui.dump.mockResolvedValueOnce([tree]);

      const result = await handleUiActionTool(
        { operation: "scroll", direction: "down", selector: { textContains: "Target" } },
        ctx as any,
      );

      expect(ctx.ui.scroll).toHaveBeenCalledWith("emulator-5554", "down", 0.5, tree.bounds);
      expect((result.scrolled as Record<string, unknown>).container).toBe("android.view.ViewGroup");
      expect(result.warning).toBeUndefined();
    });

    it("honors semantic scrollable=false over class fallback", async () => {
      const tree = scrollTree("androidx.recyclerview.widget.RecyclerView", false);
      ctx.ui.findWithFallbacks.mockResolvedValueOnce({
        elements: [tree.children[0]],
        source: "accessibility",
      });
      ctx.ui.dump.mockResolvedValueOnce([tree]);

      const result = await handleUiActionTool(
        { operation: "scroll", direction: "down", selector: { textContains: "Target" } },
        ctx as any,
      );

      expect(ctx.ui.scroll).toHaveBeenCalledWith("emulator-5554", "down", 0.5);
      expect(result.warning).toContain("no scrollable container");
    });

    it("matches Compose and legacy scrollable containers by curated class fragments", async () => {
      for (const containerClass of [
        "androidx.compose.ui.platform.AndroidComposeView",
        "androidx.compose.ui.platform.ComposeView",
        "android.widget.GridView",
        "android.widget.Gallery",
        "android.widget.NumberPicker",
      ]) {
        ctx = buildMockContext();
        const tree = scrollTree(containerClass);
        ctx.ui.findWithFallbacks.mockResolvedValueOnce({
          elements: [tree.children[0]],
          source: "accessibility",
        });
        ctx.ui.dump.mockResolvedValueOnce([tree]);

        const result = await handleUiActionTool(
          { operation: "scroll", direction: "down", selector: { textContains: "Target" } },
          ctx as any,
        );

        expect(ctx.ui.scroll).toHaveBeenCalledWith("emulator-5554", "down", 0.5, tree.bounds);
        expect((result.scrolled as Record<string, unknown>).container).toBe(containerClass);
        expect(result.warning).toBeUndefined();
      }
    });

    it("matches NestedScrollView and HorizontalScrollView via ScrollView substring", async () => {
      // The SCROLLABLE list intentionally uses substring matching ("ScrollView"),
      // which covers NestedScrollView, HorizontalScrollView, and any future
      // FooScrollView variant. Lock that in so a future "tighten the match"
      // refactor doesn't silently break it.
      for (const containerClass of [
        "androidx.core.widget.NestedScrollView",
        "android.widget.HorizontalScrollView",
      ]) {
        ctx = buildMockContext();
        const tree = {
          text: "", resourceId: "wrap", className: containerClass,
          centerX: 540, centerY: 1100, bounds: { left: 0, top: 200, right: 1080, bottom: 2000 },
          clickable: false, focusable: false, contentDesc: "", index: 0,
          children: [
            {
              text: "Save", resourceId: "btn", className: "android.widget.Button",
              centerX: 540, centerY: 900, bounds: { left: 0, top: 850, right: 1080, bottom: 950 },
              clickable: true, focusable: true, contentDesc: "", index: 0,
            },
          ],
        };
        ctx.ui.findWithFallbacks.mockResolvedValueOnce({
          elements: [tree.children![0]],
          source: "accessibility",
        });
        ctx.ui.dump.mockResolvedValueOnce([tree]);

        const result = await handleUiActionTool(
          { operation: "scroll", direction: "down", selector: { textContains: "Save" } },
          ctx as any,
        );

        expect(ctx.ui.scroll).toHaveBeenCalledWith("emulator-5554", "down", 0.5, tree.bounds);
        expect((result.scrolled as Record<string, unknown>).container).toBe(containerClass);
        expect(result.warning).toBeUndefined();
      }
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
