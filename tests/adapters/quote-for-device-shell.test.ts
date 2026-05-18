import { describe, it, expect } from "vitest";
import { quoteForDeviceShell } from "../../src/adapters/adb.js";

describe("quoteForDeviceShell", () => {
  it("wraps an empty string in single quotes", () => {
    expect(quoteForDeviceShell("")).toBe("''");
  });

  it("wraps plain ASCII unchanged inside single quotes", () => {
    expect(quoteForDeviceShell("hello")).toBe("'hello'");
  });

  it("preserves embedded `&` inside the quotes (no escape needed)", () => {
    // Inside single quotes, `&` is literal — the on-device /bin/sh won't
    // background on it. This is the property that closes the CU-2 injection.
    expect(quoteForDeviceShell("https://example.com/?foo=bar&baz=qux")).toBe(
      "'https://example.com/?foo=bar&baz=qux'",
    );
  });

  it("preserves embedded `;` and `|` inside the quotes", () => {
    expect(quoteForDeviceShell("a;b|c")).toBe("'a;b|c'");
  });

  it("escapes embedded single quote as '\\''", () => {
    // POSIX-portable single-quote escape: close, escape, reopen.
    expect(quoteForDeviceShell("foo'bar")).toBe(`'foo'\\''bar'`);
  });

  it("escapes multiple embedded single quotes", () => {
    expect(quoteForDeviceShell("'a'b'")).toBe(`''\\''a'\\''b'\\'''`);
  });
});
