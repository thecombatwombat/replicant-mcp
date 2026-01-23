import { describe, it, expect } from "vitest";
import { calculateScaleFactor } from "../../src/services/scaling.js";

describe("calculateScaleFactor", () => {
  it("returns 1.0 when device fits within max dimension", () => {
    const result = calculateScaleFactor(800, 600, 1000);
    expect(result).toBe(1.0);
  });

  it("scales based on height when height is longest side", () => {
    const result = calculateScaleFactor(1080, 2400, 1000);
    expect(result).toBe(2.4);
  });

  it("scales based on width when width is longest side (landscape)", () => {
    const result = calculateScaleFactor(2400, 1080, 1000);
    expect(result).toBe(2.4);
  });

  it("uses custom max dimension", () => {
    const result = calculateScaleFactor(1080, 2400, 1500);
    expect(result).toBe(1.6);
  });
});
