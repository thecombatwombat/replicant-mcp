import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiActionTool } from "../../src/tools/ui-action.js";
import { ErrorCode } from "../../src/types/index.js";

// THE-113 (CU-9): when `verify: true` is set on the input op, ui-action
// captures the target field's text before and after the input call and
// reports whether the input took effect. Requires a selector — we need to
// know which field to inspect.

interface MockContext {
  deviceState: { ensureDevice: ReturnType<typeof vi.fn> };
  ui: {
    findWithFallbacks: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    dump: ReturnType<typeof vi.fn>;
    tap: ReturnType<typeof vi.fn>;
    input: ReturnType<typeof vi.fn>;
    visualSnapshot: ReturnType<typeof vi.fn>;
  };
  cache: { generateId: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  lastFindResults: unknown[];
  lastFindFingerprints: string[];
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
      visualSnapshot: vi.fn(),
    },
    cache: { generateId: vi.fn().mockReturnValue("id"), set: vi.fn() },
    lastFindResults: [],
    lastFindFingerprints: [],
    config: { getUiConfig: () => ({ autoFallbackScreenshot: false, includeBase64: false }) },
  };
}

const emptyField = {
  text: "",
  resourceId: "search_field",
  className: "android.widget.EditText",
  centerX: 540,
  centerY: 200,
  bounds: { left: 100, top: 150, right: 980, bottom: 250 },
  clickable: true,
  focusable: true,
  contentDesc: "",
  index: 0,
};

const filledField = {
  ...emptyField,
  text: "hello world",
};

describe("ui-action input verify (CU-9 / THE-113)", () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = buildMockContext();
  });

  it("default (verify=false): no extra finds, no verify fields in response", async () => {
    // resourceId-only selector → handleFind routes to handleSelectorFind → ui.find
    ctx.ui.find.mockResolvedValue([emptyField]);

    const result = await handleUiActionTool(
      { operation: "input", text: "hello world", selector: { resourceId: "search_field" } },
      ctx as any,
    );

    expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 540, 200, true);
    expect(ctx.ui.input).toHaveBeenCalledWith("emulator-5554", "hello world");
    // verify=false (default) means no before/after capture.
    expect(result.verified).toBeUndefined();
    expect(result.inputBefore).toBeUndefined();
    expect(result.inputAfter).toBeUndefined();
    // ui.find called once: only for the tap target resolution.
    expect(ctx.ui.find).toHaveBeenCalledTimes(1);
  });

  it("verify=true with successful input: reports verified=true, inputBefore='', inputAfter contains text", async () => {
    // Three calls to ui.find:
    //   1. inputBefore read (empty field)
    //   2. selector resolution for the tap
    //   3. inputAfter read (filled field)
    ctx.ui.find
      .mockResolvedValueOnce([emptyField])
      .mockResolvedValueOnce([emptyField])
      .mockResolvedValueOnce([filledField]);

    const result = await handleUiActionTool(
      {
        operation: "input",
        text: "hello world",
        selector: { resourceId: "search_field" },
        verify: true,
      },
      ctx as any,
    );

    expect(result.verified).toBe(true);
    expect(result.containsRequested).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.inputBefore).toBe("");
    expect(result.inputAfter).toBe("hello world");
    expect(ctx.ui.input).toHaveBeenCalledWith("emulator-5554", "hello world");
  });

  it("verify=true when field didn't change: reports verified=false", async () => {
    // The input call somehow did nothing — both before and after read "".
    ctx.ui.find
      .mockResolvedValueOnce([emptyField])
      .mockResolvedValueOnce([emptyField])
      .mockResolvedValueOnce([emptyField]);

    const result = await handleUiActionTool(
      {
        operation: "input",
        text: "hello",
        selector: { resourceId: "search_field" },
        verify: true,
      },
      ctx as any,
    );

    expect(result.verified).toBe(false);
    expect(result.containsRequested).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.inputBefore).toBe("");
    expect(result.inputAfter).toBe("");
  });

  it("verify=true when field changed but doesn't contain requested text: verified=true (looser signal)", async () => {
    // Suggests autocomplete intervened: we asked for "abc", field shows "ABC".
    const upperCased = { ...emptyField, text: "ABC" };
    ctx.ui.find
      .mockResolvedValueOnce([emptyField])
      .mockResolvedValueOnce([emptyField])
      .mockResolvedValueOnce([upperCased]);

    const result = await handleUiActionTool(
      {
        operation: "input",
        text: "abc",
        selector: { resourceId: "search_field" },
        verify: true,
      },
      ctx as any,
    );

    // containsRequested=false (case mismatch) but changed=true, so verified=true.
    expect(result.verified).toBe(true);
    expect(result.containsRequested).toBe(false);
    expect(result.changed).toBe(true);
    expect(result.inputBefore).toBe("");
    expect(result.inputAfter).toBe("ABC");
  });

  it("verify=true when target element disappeared after input: reports verified=false (CU-13)", async () => {
    // Greptile P1 (CU-13): if the input element vanishes after typing — e.g.
    // the search field gets replaced by a results view, or focus shifts and
    // the EditText is detached — `readSelectorText` returns null. The old
    // logic compared `null !== ""` (inputBefore for an empty field) and
    // reported `verified: true` despite zero evidence the input took effect.
    // We must report verified=false here.
    ctx.ui.find
      .mockResolvedValueOnce([emptyField]) // inputBefore: empty field exists
      .mockResolvedValueOnce([emptyField]) // tap resolution
      .mockResolvedValueOnce([]); // inputAfter: element is GONE

    const result = await handleUiActionTool(
      {
        operation: "input",
        text: "hello",
        selector: { resourceId: "search_field" },
        verify: true,
      },
      ctx as any,
    );

    expect(result.verified).toBe(false);
    expect(result.containsRequested).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.inputBefore).toBe("");
    expect(result.inputAfter).toBeNull();
  });

  it("verify=true rejects when no selector provided", async () => {
    await expect(
      handleUiActionTool(
        { operation: "input", text: "x", verify: true } as any,
        ctx as any,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.INPUT_VALIDATION_FAILED });
    expect(ctx.ui.input).not.toHaveBeenCalled();
  });

  it("verify=true does not pollute lastFindResults", async () => {
    // The agent might have pre-set lastFindResults via a separate ui-query
    // find. Verify's internal find must not overwrite it.
    const previousFindResults = [{ centerX: 1, centerY: 2 } as never];
    const previousFingerprints = ["abc"];
    ctx.lastFindResults = previousFindResults;
    ctx.lastFindFingerprints = previousFingerprints;

    ctx.ui.find
      .mockResolvedValueOnce([emptyField])
      .mockResolvedValueOnce([emptyField])
      .mockResolvedValueOnce([filledField]);

    await handleUiActionTool(
      {
        operation: "input",
        text: "hello world",
        selector: { resourceId: "search_field" },
        verify: true,
      },
      ctx as any,
    );

    // verify's read+read calls saved/restored lastFindResults. The tap-side
    // selector resolution still updates it (last write wins) — but the
    // initial pre-existing entries are NOT clobbered by the inputBefore read.
    expect(ctx.lastFindResults).not.toBe(previousFindResults);
    // What matters: the tap resolution populated it with the matched field,
    // and the after-read did NOT then overwrite it with a stale snapshot.
    expect((ctx.lastFindResults as Array<{ resourceId?: string }>)[0]?.resourceId).toBe("search_field");
  });
});
