// tests/services/grid.test.ts
import { describe, it, expect } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  calculateGridCellBounds,
  calculatePositionCoordinates,
  createGridOverlay,
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

  describe("createGridOverlay", () => {
    it("creates image with numbered grid overlay", { timeout: 30000 }, async () => {
      const sharp = (await import("sharp")).default;
      const testImagePath = path.join(os.tmpdir(), "test-grid-input.png");

      // Create a test image
      await sharp({
        create: { width: 1080, height: 1920, channels: 3, background: { r: 100, g: 100, b: 100 } },
      })
        .png()
        .toFile(testImagePath);

      const base64 = await createGridOverlay(testImagePath);

      // Should return valid base64
      expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);

      // Verify it's a valid image (scaled to max 1000px dimension)
      const buffer = Buffer.from(base64, "base64");
      const metadata = await sharp(buffer).metadata();
      // Original 1080x1920 scaled to fit within 1000px max dimension
      // Scale factor: 1000/1920 = 0.5208, so 1080*0.5208 = 563, 1920*0.5208 = 1000
      expect(metadata.width).toBe(563);
      expect(metadata.height).toBe(1000);
      expect(metadata.format).toBe("jpeg"); // Now JPEG, not PNG

      await fs.unlink(testImagePath);
    });
  });
});
