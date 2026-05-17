// Tests for THE-109: `interactiveOnly` filter on ui-query find / dump.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseUiDump, isInteractiveNode } from "../../src/parsers/ui-dump.js";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";

const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="root" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]" clickable="false" focusable="false">
    <node index="0" text="Heading" resource-id="" class="android.widget.TextView" bounds="[0,0][1080,100]" clickable="false" focusable="false" />
    <node index="1" text="" resource-id="btn" class="android.widget.Button" bounds="[0,100][1080,200]" clickable="true" focusable="true" long-clickable="true" />
    <node index="2" text="" resource-id="list" class="android.widget.RecyclerView" bounds="[0,200][1080,1200]" clickable="false" focusable="false" scrollable="true" />
    <node index="3" text="" resource-id="input" class="android.widget.EditText" bounds="[0,1200][1080,1300]" clickable="false" focusable="true" editable="true" />
    <node index="4" text="More text" resource-id="" class="android.widget.TextView" bounds="[0,1300][1080,1400]" clickable="false" focusable="false" />
  </node>
</hierarchy>`;

describe("ui-dump parser: long-clickable / editable extraction", () => {
  it("parses long-clickable=true as longClickable: true", () => {
    const [root] = parseUiDump(FIXTURE_XML);
    const button = root.children!.find((n) => n.resourceId === "btn")!;
    expect(button.longClickable).toBe(true);
  });

  it("parses editable=true as editable: true", () => {
    const [root] = parseUiDump(FIXTURE_XML);
    const input = root.children!.find((n) => n.resourceId === "input")!;
    expect(input.editable).toBe(true);
  });

  it("leaves longClickable / editable undefined when the attribute is absent", () => {
    const [root] = parseUiDump(FIXTURE_XML);
    const heading = root.children!.find((n) => n.resourceId === "" && n.text === "Heading")!;
    expect(heading.longClickable).toBeUndefined();
    expect(heading.editable).toBeUndefined();
  });
});

describe("isInteractiveNode", () => {
  function node(overrides: Partial<{ clickable: boolean; focusable: boolean; scrollable: boolean; longClickable: boolean; editable: boolean }>): any {
    return {
      clickable: false,
      focusable: false,
      ...overrides,
    };
  }

  it("returns true when clickable", () => {
    expect(isInteractiveNode(node({ clickable: true }))).toBe(true);
  });
  it("returns true when long-clickable", () => {
    expect(isInteractiveNode(node({ longClickable: true }))).toBe(true);
  });
  it("returns true when focusable", () => {
    expect(isInteractiveNode(node({ focusable: true }))).toBe(true);
  });
  it("returns true when editable", () => {
    expect(isInteractiveNode(node({ editable: true }))).toBe(true);
  });
  it("returns true when scrollable", () => {
    expect(isInteractiveNode(node({ scrollable: true }))).toBe(true);
  });
  it("returns false when none of the five flags are set", () => {
    expect(isInteractiveNode(node({}))).toBe(false);
  });
});

describe("ui-query dump interactiveOnly (THE-109)", () => {
  let ctx: any;
  const cfg = { autoFallbackScreenshot: false, includeBase64: false, maxImageDimension: 800 };

  beforeEach(() => {
    ctx = {
      deviceState: { ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }) },
      ui: {
        dump: vi.fn().mockResolvedValue(parseUiDump(FIXTURE_XML)),
        getCurrentApp: vi.fn().mockResolvedValue(null),
        getScalingState: vi.fn().mockReturnValue(null),
      },
      cache: { generateId: vi.fn().mockReturnValue("d-1"), set: vi.fn() },
    };
  });

  it("default (interactiveOnly absent) returns only clickable||focusable nodes — preserves prior behavior", async () => {
    const result: any = await handleUiQueryTool({ operation: "dump" }, ctx, cfg);
    const resourceIds = result.elements.map((e: any) => e.resourceId).sort();
    // Pre-CU-5 logic kept only clickable||focusable: btn (clickable+focusable) and input (focusable).
    // The RecyclerView (scrollable-only) and TextViews (no flags) are excluded.
    expect(resourceIds).toEqual(["btn", "input"]);
  });

  it("interactiveOnly=true widens the filter to long-clickable / editable / scrollable", async () => {
    const result: any = await handleUiQueryTool(
      { operation: "dump", interactiveOnly: true },
      ctx,
      cfg,
    );
    const resourceIds = result.elements.map((e: any) => e.resourceId).sort();
    // Now the scrollable RecyclerView is also included alongside btn and input.
    expect(resourceIds).toEqual(["btn", "input", "list"]);
  });

  it("compact=false interactiveOnly=true prunes non-interactive subtrees while preserving the tree shape (CU-5 follow-up)", async () => {
    const result: any = await handleUiQueryTool(
      { operation: "dump", compact: false, interactiveOnly: true },
      ctx,
      cfg,
    );
    expect(result.tree).toHaveLength(1);
    const root = result.tree[0];
    // The root FrameLayout is non-interactive but kept because it has
    // interactive descendants — pruning preserves structural ancestors.
    expect(root.resourceId).toBe("root");
    // The two non-interactive TextView leaves (Heading, More text) are
    // pruned; only the three interactive children survive.
    expect(root.children).toHaveLength(3);
    const childIdentities = (root.children ?? []).map(
      (c: any) => c.resourceId ?? c.text ?? c.className,
    );
    expect(childIdentities.sort()).toEqual(["btn", "input", "list"]);
  });

  it("compact=false (interactiveOnly absent) returns the full unpruned tree", async () => {
    const result: any = await handleUiQueryTool(
      { operation: "dump", compact: false },
      ctx,
      cfg,
    );
    expect(result.tree).toHaveLength(1);
    const root = result.tree[0];
    expect(root.children).toHaveLength(5);
  });
});

describe("ui-query find interactiveOnly (THE-109)", () => {
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
    };
  });

  it("selector path: interactiveOnly=true prunes non-interactive accessibility matches", async () => {
    const tree = parseUiDump(FIXTURE_XML);
    const flat = tree.flatMap((n) => [n, ...(n.children ?? [])]);
    ctx.ui.find.mockResolvedValue(flat);

    const result: any = await handleUiQueryTool(
      { operation: "find", selector: { className: "android" }, interactiveOnly: true },
      ctx,
      cfg,
    );
    const ids = result.elements.map((e: any) => e.resourceId).sort();
    // Out of all class="android.*" matches, only nodes with at least one of
    // the five interactivity flags survive: btn, input, list.
    expect(ids).toEqual(["btn", "input", "list"]);
  });

  it("selector path: default (no interactiveOnly) returns all selector matches", async () => {
    const tree = parseUiDump(FIXTURE_XML);
    const flat = tree.flatMap((n) => [n, ...(n.children ?? [])]);
    ctx.ui.find.mockResolvedValue(flat);

    const result: any = await handleUiQueryTool(
      { operation: "find", selector: { className: "android" } },
      ctx,
      cfg,
    );
    expect(result.elements.length).toBe(flat.length);
  });

  it("text path: interactiveOnly=true prunes non-interactive accessibility nodes; OCR results pass through", async () => {
    const tree = parseUiDump(FIXTURE_XML);
    const flat = tree.flatMap((n) => [n, ...(n.children ?? [])]);
    // Two of these are interactive (btn, input), two are not (root, the two TextViews).
    // Also include one OCR-shaped element to confirm it survives the filter.
    const ocr = { text: "OCR match", center: { x: 100, y: 100 }, bounds: "[0,0][200,200]", confidence: 0.9 };
    ctx.ui.findWithFallbacks.mockResolvedValue({
      elements: [...flat, ocr],
      source: "accessibility",
    });

    const result: any = await handleUiQueryTool(
      { operation: "find", selector: { text: "anything" }, interactiveOnly: true },
      ctx,
      cfg,
    );
    const interactiveAxIds = result.elements
      .filter((e: any) => e.resourceId !== undefined)
      .map((e: any) => e.resourceId)
      .sort();
    expect(interactiveAxIds).toEqual(["btn", "input", "list"]);
    // OCR element survives — it's a tap target without the AX flags.
    const hasOcr = result.elements.some((e: any) => e.text === "OCR match");
    expect(hasOcr).toBe(true);
  });
});
