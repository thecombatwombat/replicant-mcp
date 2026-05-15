// Tests for THE-108: bestTappable ranking heuristic + auto-pick in ui-action.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { rankBestTappable } from "../../src/tools/util-rank.js";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";
import { handleUiActionTool } from "../../src/tools/ui-action.js";

function axNode(overrides: any): any {
  return {
    index: 0,
    text: overrides.text ?? "",
    resourceId: overrides.resourceId ?? "",
    className: overrides.className ?? "android.view.View",
    contentDesc: overrides.contentDesc ?? "",
    bounds: overrides.bounds ?? { left: 0, top: 0, right: 100, bottom: 100 },
    centerX: 50,
    centerY: 50,
    clickable: overrides.clickable ?? false,
    focusable: overrides.focusable ?? false,
    longClickable: overrides.longClickable,
    editable: overrides.editable,
    scrollable: overrides.scrollable,
  };
}

describe("rankBestTappable (THE-108)", () => {
  it("returns the input unchanged for 0 or 1 elements", () => {
    expect(rankBestTappable([]).ranked).toEqual([]);
    const one = [axNode({ resourceId: "only" })];
    expect(rankBestTappable(one).ranked).toEqual(one);
    expect(rankBestTappable(one).pickedRationale).toBeUndefined();
  });

  it("prefers clickable over non-clickable when bbox sizes are similar", () => {
    const clickable = axNode({
      resourceId: "btn",
      clickable: true,
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
    });
    const wrapper = axNode({
      resourceId: "wrap",
      clickable: false,
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
    });
    const result = rankBestTappable([wrapper, clickable]);
    expect(result.ranked[0].resourceId).toBe("btn");
  });

  it("prefers smaller bounding box when both candidates are clickable", () => {
    const small = axNode({
      resourceId: "small",
      clickable: true,
      bounds: { left: 0, top: 0, right: 50, bottom: 50 },
    });
    const large = axNode({
      resourceId: "large",
      clickable: true,
      bounds: { left: 0, top: 0, right: 200, bottom: 200 },
    });
    const result = rankBestTappable([large, small]);
    expect(result.ranked[0].resourceId).toBe("small");
  });

  it("penalizes a full-screen / root container even when it's clickable", () => {
    const root = axNode({
      resourceId: "root",
      clickable: true,
      bounds: { left: 0, top: 0, right: 1080, bottom: 2400 },
    });
    const inner = axNode({
      resourceId: "inner",
      clickable: false,
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
    });
    const result = rankBestTappable([root, inner]);
    expect(result.ranked[0].resourceId).toBe("inner");
  });

  it("emits pickedRationale and alternatives for multi-candidate inputs", () => {
    const a = axNode({ resourceId: "a", clickable: true, bounds: { left: 0, top: 0, right: 80, bottom: 60 } });
    const b = axNode({ resourceId: "b", clickable: false, bounds: { left: 0, top: 0, right: 80, bottom: 60 } });
    const result = rankBestTappable([b, a]);
    expect(result.pickedRationale).toBeDefined();
    expect(result.pickedRationale).toContain("clickable=true");
    expect(result.alternativeSummaries).toBeDefined();
    expect(result.alternativeSummaries!.length).toBe(1);
    expect((result.alternativeSummaries![0] as any).resourceId).toBe("b");
  });
});

describe("ui-action tap rank=bestTappable (THE-108)", () => {
  let ctx: any;
  const cfg = { autoFallbackScreenshot: false, includeBase64: false, maxImageDimension: 800 };

  beforeEach(() => {
    ctx = {
      deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }) },
      ui: {
        find: vi.fn(),
        findWithFallbacks: vi.fn(),
        tap: vi.fn().mockResolvedValue(undefined),
        getCurrentApp: vi.fn().mockResolvedValue(null),
        visualSnapshot: vi.fn(),
      },
      cache: { generateId: vi.fn(), set: vi.fn() },
      lastFindResults: [],
    };
  });

  it("auto-picks top-ranked match when matches > 1 and rank=bestTappable", async () => {
    const root = axNode({
      resourceId: "root",
      clickable: true,
      bounds: { left: 0, top: 0, right: 1080, bottom: 2400 },
    });
    const btn = axNode({
      resourceId: "btn",
      clickable: true,
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
    });
    ctx.ui.findWithFallbacks.mockResolvedValue({ elements: [root, btn], source: "accessibility" });

    const result: any = await handleUiActionTool(
      {
        operation: "tap",
        selector: { text: "Open", rank: "bestTappable" },
      },
      ctx,
      cfg,
    );

    // Tapped the inner button (smaller bbox), not the root container.
    expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", btn.centerX, btn.centerY, true);
    expect(result.pickedRationale).toBeDefined();
    expect(result.alternatives).toBeDefined();
    expect(result.alternatives.length).toBe(1);
  });

  it("default behavior unchanged: ambiguous matches without rank still throw AMBIGUOUS_MATCH", async () => {
    const a = axNode({ resourceId: "a", clickable: true });
    const b = axNode({ resourceId: "b", clickable: true });
    ctx.ui.findWithFallbacks.mockResolvedValue({ elements: [a, b], source: "accessibility" });

    await expect(
      handleUiActionTool(
        { operation: "tap", selector: { text: "Open" } },
        ctx,
        cfg,
      ),
    ).rejects.toThrow(/AMBIGUOUS_MATCH|Selector matched 2 elements/);
  });

  it("rank=bestTappable with a single match doesn't add rationale (degenerate case)", async () => {
    const only = axNode({ resourceId: "only", clickable: true });
    ctx.ui.findWithFallbacks.mockResolvedValue({ elements: [only], source: "accessibility" });

    const result: any = await handleUiActionTool(
      {
        operation: "tap",
        selector: { text: "Open", rank: "bestTappable" },
      },
      ctx,
      cfg,
    );

    expect(ctx.ui.tap).toHaveBeenCalled();
    expect(result.pickedRationale).toBeUndefined();
  });
});

describe("ui-query find rank=bestTappable (THE-108)", () => {
  let ctx: any;
  const cfg = { autoFallbackScreenshot: false, includeBase64: false, maxImageDimension: 800 };

  beforeEach(() => {
    ctx = {
      deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }) },
      ui: {
        find: vi.fn(),
        findWithFallbacks: vi.fn(),
        getCurrentApp: vi.fn().mockResolvedValue(null),
        visualSnapshot: vi.fn(),
      },
      cache: { generateId: vi.fn(), set: vi.fn() },
      lastFindResults: [],
    };
  });

  it("orders elements by rank score and emits rationale + alternatives", async () => {
    const root = axNode({
      resourceId: "root",
      clickable: true,
      bounds: { left: 0, top: 0, right: 1080, bottom: 2400 },
    });
    const btn = axNode({
      resourceId: "btn",
      clickable: true,
      bounds: { left: 0, top: 0, right: 100, bottom: 100 },
    });
    ctx.ui.findWithFallbacks.mockResolvedValue({ elements: [root, btn], source: "accessibility" });

    const result: any = await handleUiQueryTool(
      {
        operation: "find",
        selector: { text: "Open", rank: "bestTappable" },
      },
      ctx,
      cfg,
    );

    expect(result.elements[0].resourceId).toBe("btn");
    expect(result.pickedRationale).toBeDefined();
    expect(result.alternatives).toBeDefined();
  });
});
