// tests/services/grid.test.ts
import { describe, it, expect } from "vitest";
import {
  calculateGridCellBounds,
  calculatePositionCoordinates,
  GRID_COLS,
  GRID_ROWS,
} from "../../src/services/grid.js";

describe("grid", () => {
  const screenWidth = 1080;
  const screenHeight = 1920;

  describe("calculateGridCellBounds", () => {
    it("calculates bounds for cell 1 (top-left)", () => {
      const bounds = calculateGridCellBounds(1, screenWidth, screenHeight);
      expect(bounds.x0).toBe(0);
      expect(bounds.y0).toBe(0);
      expect(bounds.x1).toBe(270); // 1080 / 4
      expect(bounds.y1).toBe(320); // 1920 / 6
    });

    it("calculates bounds for cell 24 (bottom-right)", () => {
      const bounds = calculateGridCellBounds(24, screenWidth, screenHeight);
      expect(bounds.x0).toBe(810); // 3 * 270
      expect(bounds.y0).toBe(1600); // 5 * 320
      expect(bounds.x1).toBe(1080);
      expect(bounds.y1).toBe(1920);
    });

    it("throws for invalid cell number", () => {
      expect(() => calculateGridCellBounds(0, screenWidth, screenHeight)).toThrow();
      expect(() => calculateGridCellBounds(25, screenWidth, screenHeight)).toThrow();
    });
  });

  describe("calculatePositionCoordinates", () => {
    it("calculates center position (3)", () => {
      const cellBounds = { x0: 0, y0: 0, x1: 270, y1: 320 };
      const coords = calculatePositionCoordinates(3, cellBounds);
      expect(coords.x).toBe(135); // center
      expect(coords.y).toBe(160); // center
    });

    it("calculates top-left position (1)", () => {
      const cellBounds = { x0: 0, y0: 0, x1: 270, y1: 320 };
      const coords = calculatePositionCoordinates(1, cellBounds);
      expect(coords.x).toBe(68); // 1/4 of width (270 * 0.25 = 67.5, rounds to 68)
      expect(coords.y).toBe(80); // 1/4 of height
    });

    it("calculates bottom-right position (5)", () => {
      const cellBounds = { x0: 0, y0: 0, x1: 270, y1: 320 };
      const coords = calculatePositionCoordinates(5, cellBounds);
      expect(coords.x).toBe(203); // 3/4 of width (270 * 0.75 = 202.5, rounds to 203)
      expect(coords.y).toBe(240); // 3/4 of height
    });
  });

  describe("constants", () => {
    it("has 4 columns and 6 rows (24 cells)", () => {
      expect(GRID_COLS).toBe(4);
      expect(GRID_ROWS).toBe(6);
      expect(GRID_COLS * GRID_ROWS).toBe(24);
    });
  });
});
