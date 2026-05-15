import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";
import { handleUiActionTool } from "../../src/tools/ui-action.js";
import { ErrorCode, ReplicantError } from "../../src/types/index.js";
import {
  computeAccessibilityFingerprint,
  computeFingerprints,
} from "../../src/tools/util-fingerprint.js";

// THE-112 (CU-8): cross-call element stability check.
//
// ui-query find stores `lastFindResults` plus a content fingerprint per
// element. ui-action's elementIndex path re-dumps the tree at consume time,
// finds the node currently at the cached center, recomputes the fingerprint,
// and rejects with STALE_ELEMENT_INDEX if the screen has moved on.

const submitButton = {
  text: "Submit",
  resourceId: "btn_submit",
  className: "android.widget.Button",
  centerX: 300,
  centerY: 500,
  bounds: { left: 200, top: 450, right: 400, bottom: 550 },
  clickable: true,
  focusable: true,
  contentDesc: "",
  index: 0,
};

function buildMockContext() {
  return {
    deviceState: {
      ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
    },
    ui: {
      findWithFallbacks: vi.fn(),
      find: vi.fn(),
      dump: vi.fn(),
      tap: vi.fn().mockResolvedValue(undefined),
    },
    cache: { generateId: vi.fn().mockReturnValue("id"), set: vi.fn() },
    lastFindResults: [] as unknown[],
    lastFindFingerprints: [] as string[],
  };
}

describe("computeAccessibilityFingerprint", () => {
  it("changes when text changes", () => {
    const before = computeAccessibilityFingerprint(submitButton as any);
    const after = computeAccessibilityFingerprint({
      ...submitButton,
      text: "Submitted",
    } as any);
    expect(before).not.toBe(after);
  });

  it("changes when resourceId changes", () => {
    const before = computeAccessibilityFingerprint(submitButton as any);
    const after = computeAccessibilityFingerprint({
      ...submitButton,
      resourceId: "btn_other",
    } as any);
    expect(before).not.toBe(after);
  });

  it("changes when className changes", () => {
    const before = computeAccessibilityFingerprint(submitButton as any);
    const after = computeAccessibilityFingerprint({
      ...submitButton,
      className: "android.widget.TextView",
    } as any);
    expect(before).not.toBe(after);
  });

  it("changes when bounds shift", () => {
    const before = computeAccessibilityFingerprint(submitButton as any);
    const after = computeAccessibilityFingerprint({
      ...submitButton,
      bounds: { left: 210, top: 450, right: 400, bottom: 550 },
    } as any);
    expect(before).not.toBe(after);
  });

  it("is stable across two identical dumps of the same node", () => {
    const a = computeAccessibilityFingerprint(submitButton as any);
    const b = computeAccessibilityFingerprint({ ...submitButton } as any);
    expect(a).toBe(b);
  });

  it("returns empty string for non-accessibility elements (OCR/grid)", () => {
    const fps = computeFingerprints([
      { text: "OCR text", confidence: 0.8, center: { x: 1, y: 2 }, bounds: {} } as any,
    ]);
    expect(fps[0]).toBe("");
  });
});

describe("ui-action elementIndex stale check (CU-8)", () => {
  let ctx: ReturnType<typeof buildMockContext>;

  beforeEach(() => {
    ctx = buildMockContext();
  });

  it("succeeds when the screen is unchanged between find and tap", async () => {
    ctx.ui.findWithFallbacks.mockResolvedValue({
      elements: [submitButton],
      source: "accessibility",
    });
    ctx.ui.dump.mockResolvedValue([submitButton]);

    await handleUiQueryTool(
      { operation: "find", selector: { text: "Submit" } },
      ctx as any,
    );
    const result = await handleUiActionTool(
      { operation: "tap", elementIndex: 0 },
      ctx as any,
    );

    expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 300, 500, true);
    expect(result.tapped).toEqual({ x: 300, y: 500, deviceSpace: true });
  });

  it("throws STALE_ELEMENT_INDEX when the text at the cached center changes", async () => {
    ctx.ui.findWithFallbacks.mockResolvedValue({
      elements: [submitButton],
      source: "accessibility",
    });
    // Live dump: same center, different text — fingerprint mismatch.
    ctx.ui.dump.mockResolvedValue([{ ...submitButton, text: "Cancel" }]);

    await handleUiQueryTool(
      { operation: "find", selector: { text: "Submit" } },
      ctx as any,
    );

    try {
      await handleUiActionTool(
        { operation: "tap", elementIndex: 0 },
        ctx as any,
      );
      throw new Error("expected STALE_ELEMENT_INDEX");
    } catch (err) {
      expect(err).toBeInstanceOf(ReplicantError);
      expect((err as ReplicantError).code).toBe(ErrorCode.STALE_ELEMENT_INDEX);
    }
    expect(ctx.ui.tap).not.toHaveBeenCalled();
  });

  it("throws STALE_ELEMENT_INDEX when bounds shift at the cached center", async () => {
    ctx.ui.findWithFallbacks.mockResolvedValue({
      elements: [submitButton],
      source: "accessibility",
    });
    // Different bounds — fingerprint mismatch even though center matches.
    ctx.ui.dump.mockResolvedValue([
      {
        ...submitButton,
        bounds: { left: 210, top: 450, right: 400, bottom: 550 },
      },
    ]);

    await handleUiQueryTool(
      { operation: "find", selector: { text: "Submit" } },
      ctx as any,
    );

    await expect(
      handleUiActionTool({ operation: "tap", elementIndex: 0 }, ctx as any),
    ).rejects.toMatchObject({ code: ErrorCode.STALE_ELEMENT_INDEX });
    expect(ctx.ui.tap).not.toHaveBeenCalled();
  });

  it("throws STALE_ELEMENT_INDEX when no node exists at the cached center anymore", async () => {
    ctx.ui.findWithFallbacks.mockResolvedValue({
      elements: [submitButton],
      source: "accessibility",
    });
    // Live dump: a completely different layout — no node at (300, 500).
    ctx.ui.dump.mockResolvedValue([
      { ...submitButton, centerX: 700, centerY: 1200 },
    ]);

    await handleUiQueryTool(
      { operation: "find", selector: { text: "Submit" } },
      ctx as any,
    );

    await expect(
      handleUiActionTool({ operation: "tap", elementIndex: 0 }, ctx as any),
    ).rejects.toMatchObject({ code: ErrorCode.STALE_ELEMENT_INDEX });
  });

  it("skips the stale check when the cached element is OCR/grid (empty fingerprint)", async () => {
    // OCR element — no AccessibilityNode shape, no stable identity.
    ctx.ui.findWithFallbacks.mockResolvedValue({
      elements: [
        {
          text: "Login",
          center: { x: 100, y: 100 },
          bounds: { left: 0, top: 0, right: 200, bottom: 200 },
          confidence: 0.9,
        },
      ],
      source: "ocr",
    });

    await handleUiQueryTool(
      { operation: "find", selector: { text: "Login" } },
      ctx as any,
    );
    // Even with no dump set up, the stale check should be skipped — OCR
    // elements get an empty fingerprint and no re-check.
    await handleUiActionTool(
      { operation: "tap", elementIndex: 0 },
      ctx as any,
    );

    expect(ctx.ui.tap).toHaveBeenCalled();
    expect(ctx.ui.dump).not.toHaveBeenCalled();
  });

  it("preserves backward compat: empty lastFindFingerprints disables the check", async () => {
    // Simulate an older caller that populated lastFindResults directly
    // (e.g. an existing integration test) without fingerprints.
    ctx.lastFindResults = [submitButton];
    ctx.lastFindFingerprints = [];

    await handleUiActionTool(
      { operation: "tap", elementIndex: 0 },
      ctx as any,
    );
    expect(ctx.ui.tap).toHaveBeenCalledWith("emulator-5554", 300, 500, true);
    expect(ctx.ui.dump).not.toHaveBeenCalled();
  });

  it("error context includes the cached fingerprint and live fingerprint for debugging", async () => {
    ctx.ui.findWithFallbacks.mockResolvedValue({
      elements: [submitButton],
      source: "accessibility",
    });
    ctx.ui.dump.mockResolvedValue([{ ...submitButton, text: "Confirm" }]);

    await handleUiQueryTool(
      { operation: "find", selector: { text: "Submit" } },
      ctx as any,
    );

    try {
      await handleUiActionTool(
        { operation: "tap", elementIndex: 0 },
        ctx as any,
      );
      throw new Error("expected STALE_ELEMENT_INDEX");
    } catch (err) {
      const e = err as ReplicantError;
      expect(e.code).toBe(ErrorCode.STALE_ELEMENT_INDEX);
      const details = e.context?.buildResult as Record<string, unknown>;
      expect(details.cachedFingerprint).toBeDefined();
      expect(details.liveFingerprint).toBeDefined();
      expect(details.cachedFingerprint).not.toBe(details.liveFingerprint);
    }
  });
});
