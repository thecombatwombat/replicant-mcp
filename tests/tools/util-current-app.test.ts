import { describe, it, expect, vi } from "vitest";
import { getCurrentAppSafe } from "../../src/tools/util-current-app.js";

describe("getCurrentAppSafe (THE-107)", () => {
  function makeContext(getCurrentApp: ReturnType<typeof vi.fn>): any {
    return { ui: { getCurrentApp } };
  }

  it("returns the value from context.ui.getCurrentApp on success", async () => {
    const ctx = makeContext(
      vi.fn().mockResolvedValue({ packageName: "com.example", activityName: ".Main" }),
    );
    const result = await getCurrentAppSafe(ctx, "emulator-5554");
    expect(result).toEqual({ packageName: "com.example", activityName: ".Main" });
  });

  it("returns null when getCurrentApp throws", async () => {
    const ctx = makeContext(vi.fn().mockRejectedValue(new Error("adb offline")));
    const result = await getCurrentAppSafe(ctx, "emulator-5554");
    expect(result).toBeNull();
  });

  it("never throws even when getCurrentApp throws a non-Error value", async () => {
    const ctx = makeContext(vi.fn().mockRejectedValue("unstructured failure"));
    await expect(getCurrentAppSafe(ctx, "emulator-5554")).resolves.toBeNull();
  });

  it("propagates the unknown/unknown sentinel from getCurrentApp (does not coerce to null)", async () => {
    // getCurrentApp's own contract is to return { packageName: 'unknown', activityName: 'unknown' }
    // when it cannot determine the foreground app. We faithfully forward that — only an
    // exception, not a sentinel, downgrades to null.
    const ctx = makeContext(
      vi.fn().mockResolvedValue({ packageName: "unknown", activityName: "unknown" }),
    );
    const result = await getCurrentAppSafe(ctx, "emulator-5554");
    expect(result).toEqual({ packageName: "unknown", activityName: "unknown" });
  });
});
