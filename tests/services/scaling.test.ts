import { describe, it, expect } from "vitest";
import { calculateScaleFactor, toImageSpace, toDeviceSpace, boundsToImageSpace } from "../../src/services/scaling.js";

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

describe("toImageSpace", () => {
  it("converts device coordinates to image coordinates", () => {
    const result = toImageSpace(480, 1200, 2.4);
    expect(result).toEqual({ x: 200, y: 500 });
  });

  it("returns same coordinates when scale factor is 1.0", () => {
    const result = toImageSpace(480, 1200, 1.0);
    expect(result).toEqual({ x: 480, y: 1200 });
  });

  it("rounds to nearest integer", () => {
    const result = toImageSpace(100, 100, 3);
    expect(result).toEqual({ x: 33, y: 33 });
  });
});

describe("toDeviceSpace", () => {
  it("converts image coordinates to device coordinates", () => {
    const result = toDeviceSpace(200, 500, 2.4);
    expect(result).toEqual({ x: 480, y: 1200 });
  });

  it("returns same coordinates when scale factor is 1.0", () => {
    const result = toDeviceSpace(200, 500, 1.0);
    expect(result).toEqual({ x: 200, y: 500 });
  });

  it("rounds to nearest integer", () => {
    const result = toDeviceSpace(33, 33, 3);
    expect(result).toEqual({ x: 99, y: 99 });
  });
});

describe("boundsToImageSpace", () => {
  it("converts all four corners", () => {
    const bounds = { left: 240, top: 480, right: 480, bottom: 720 };
    const result = boundsToImageSpace(bounds, 2.4);
    expect(result).toEqual({ left: 100, top: 200, right: 200, bottom: 300 });
  });

  it("returns same bounds when scale factor is 1.0", () => {
    const bounds = { left: 100, top: 200, right: 300, bottom: 400 };
    const result = boundsToImageSpace(bounds, 1.0);
    expect(result).toEqual(bounds);
  });
});
