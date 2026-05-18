import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAdbAppTool } from "../../src/tools/adb-app.js";
import { ReplicantError, ErrorCode } from "../../src/types/index.js";

// CU-2 (THE-106): the `start-intent` op fires `am start` via the typed
// startIntent adapter method. We assert the tool handler propagates inputs
// through the adapter and surfaces parsed status back to the caller.

interface MockContext {
  deviceState: { ensureDevice: ReturnType<typeof vi.fn> };
  adb: {
    startIntent: ReturnType<typeof vi.fn>;
  };
}

function buildMockContext(): MockContext {
  return {
    deviceState: {
      ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
    },
    adb: {
      startIntent: vi.fn(),
    },
  };
}

describe("adb-app start-intent op (CU-2 / THE-106)", () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = buildMockContext();
  });

  it("calls adb.startIntent with a URL containing `&` (no metacharacter rejection)", async () => {
    ctx.adb.startIntent.mockResolvedValue({
      raw: "Status: ok\n",
      status: "ok",
      ok: true,
    });

    const result = await handleAdbAppTool(
      {
        operation: "start-intent",
        action: "android.intent.action.VIEW",
        data: "https://example.com/?foo=bar&baz=qux",
      },
      ctx as any,
    );

    expect(ctx.adb.startIntent).toHaveBeenCalledWith("emulator-5554", {
      action: "android.intent.action.VIEW",
      data: "https://example.com/?foo=bar&baz=qux",
      package: undefined,
      component: undefined,
      extras: undefined,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect((result.intentStarted as { data?: string }).data).toBe(
      "https://example.com/?foo=bar&baz=qux",
    );
  });

  it("passes string extras through to the adapter", async () => {
    ctx.adb.startIntent.mockResolvedValue({
      raw: "Status: ok",
      status: "ok",
      ok: true,
    });

    await handleAdbAppTool(
      {
        operation: "start-intent",
        action: "android.intent.action.SEND",
        extras: { android_intent_extra_TEXT: "Hello & welcome" },
      },
      ctx as any,
    );

    expect(ctx.adb.startIntent).toHaveBeenCalledWith(
      "emulator-5554",
      expect.objectContaining({
        action: "android.intent.action.SEND",
        extras: { android_intent_extra_TEXT: "Hello & welcome" },
      }),
    );
  });

  it("works without a data URI", async () => {
    ctx.adb.startIntent.mockResolvedValue({
      raw: "Status: ok",
      status: "ok",
      ok: true,
    });

    const result = await handleAdbAppTool(
      {
        operation: "start-intent",
        action: "android.intent.action.MAIN",
        packageName: "com.example.app",
      },
      ctx as any,
    );

    expect(ctx.adb.startIntent).toHaveBeenCalledWith(
      "emulator-5554",
      expect.objectContaining({
        action: "android.intent.action.MAIN",
        package: "com.example.app",
        data: undefined,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects start-intent without an action", async () => {
    await expect(
      handleAdbAppTool({ operation: "start-intent" } as any, ctx as any),
    ).rejects.toMatchObject({ code: ErrorCode.INPUT_VALIDATION_FAILED });
    expect(ctx.adb.startIntent).not.toHaveBeenCalled();
  });

  it("propagates adapter validation errors", async () => {
    ctx.adb.startIntent.mockRejectedValueOnce(
      new ReplicantError(
        ErrorCode.INPUT_VALIDATION_FAILED,
        "Invalid intent action: bad",
      ),
    );

    await expect(
      handleAdbAppTool(
        {
          operation: "start-intent",
          action: "bad",
        },
        ctx as any,
      ),
    ).rejects.toThrow("Invalid intent action");
  });

  it("returns status=Error on adapter ok=false", async () => {
    ctx.adb.startIntent.mockResolvedValue({
      raw: "Error: Activity not started",
      status: undefined,
      ok: false,
    });

    const result = await handleAdbAppTool(
      {
        operation: "start-intent",
        action: "android.intent.action.VIEW",
        data: "https://example.com/",
      },
      ctx as any,
    );

    expect(result.ok).toBe(false);
  });
});
