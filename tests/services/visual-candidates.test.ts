import { describe, it, expect } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  cropCandidateImage,
  filterIconCandidates,
  isIconSized,
  MIN_ICON_SIZE,
  MAX_ICON_SIZE,
} from "../../src/services/visual-candidates.js";
import { AccessibilityNode } from "../../src/parsers/ui-dump.js";

describe("visual-candidates", () => {
  describe("isIconSized", () => {
    it("returns true for typical icon size (48x48)", () => {
      expect(isIconSized(48, 48)).toBe(true);
    });

    it("returns true for large FAB (168x168)", () => {
      expect(isIconSized(168, 168)).toBe(true);
    });

    it("returns false for too small (10x10)", () => {
      expect(isIconSized(10, 10)).toBe(false);
    });

    it("returns false for too large (250x250)", () => {
      expect(isIconSized(250, 250)).toBe(false);
    });

    it("returns false for bad aspect ratio (200x40)", () => {
      expect(isIconSized(200, 40)).toBe(false); // ratio = 5
    });

    it("returns true for acceptable aspect ratio (80x50)", () => {
      expect(isIconSized(80, 50)).toBe(true); // ratio = 1.6
    });
  });

  describe("filterIconCandidates", () => {
    const makeNode = (overrides: Partial<AccessibilityNode>): AccessibilityNode => ({
      index: 0,
      text: "",
      resourceId: "",
      className: "android.widget.ImageButton",
      contentDesc: "",
      bounds: { left: 0, top: 0, right: 48, bottom: 48 },
      centerX: 24,
      centerY: 24,
      clickable: true,
      focusable: false,
      ...overrides,
    });

    it("returns clickable elements without text in icon size range", () => {
      const nodes = [
        makeNode({ bounds: { left: 0, top: 0, right: 48, bottom: 48 } }),
        makeNode({ bounds: { left: 100, top: 0, right: 148, bottom: 48 } }),
      ];

      const candidates = filterIconCandidates(nodes);
      expect(candidates.length).toBe(2);
    });

    it("excludes elements with text", () => {
      const nodes = [
        makeNode({ text: "Menu" }),
      ];

      const candidates = filterIconCandidates(nodes);
      expect(candidates.length).toBe(0);
    });

    it("excludes elements with contentDesc", () => {
      const nodes = [
        makeNode({ contentDesc: "More options" }),
      ];

      const candidates = filterIconCandidates(nodes);
      expect(candidates.length).toBe(0);
    });

    it("excludes non-clickable elements", () => {
      const nodes = [
        makeNode({ clickable: false }),
      ];

      const candidates = filterIconCandidates(nodes);
      expect(candidates.length).toBe(0);
    });

    it("limits to max 6 candidates sorted by position (top-to-bottom, left-to-right)", () => {
      const nodes = Array.from({ length: 10 }, (_, i) =>
        makeNode({
          bounds: { left: (i % 3) * 100, top: Math.floor(i / 3) * 100, right: (i % 3) * 100 + 48, bottom: Math.floor(i / 3) * 100 + 48 },
          centerX: (i % 3) * 100 + 24,
          centerY: Math.floor(i / 3) * 100 + 24,
        })
      );

      const candidates = filterIconCandidates(nodes);
      expect(candidates.length).toBe(6);
      // First should be top-left (y=24, x=24)
      expect(candidates[0].centerY).toBe(24);
    });
  });

  describe("constants", () => {
    it("has correct size bounds", () => {
      expect(MIN_ICON_SIZE).toBe(16);
      expect(MAX_ICON_SIZE).toBe(200);
    });
  });

  describe("cropCandidateImage", () => {
    it("crops and encodes image region as base64 JPEG", async () => {
      // Create a simple test image (100x100 red square)
      const sharp = (await import("sharp")).default;
      const testImagePath = path.join(os.tmpdir(), "test-crop-input.png");
      await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .png()
        .toFile(testImagePath);

      const base64 = await cropCandidateImage(testImagePath, {
        left: 10,
        top: 10,
        right: 60,
        bottom: 60,
      });

      // Should return valid base64
      expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);

      // Decode and verify dimensions
      const buffer = Buffer.from(base64, "base64");
      const metadata = await sharp(buffer).metadata();
      expect(metadata.width).toBe(50);
      expect(metadata.height).toBe(50);
      expect(metadata.format).toBe("jpeg");

      await fs.unlink(testImagePath);
    });

    it("scales down large regions to max 128x128", async () => {
      const sharp = (await import("sharp")).default;
      const testImagePath = path.join(os.tmpdir(), "test-crop-large.png");
      await sharp({
        create: { width: 500, height: 500, channels: 3, background: { r: 0, g: 255, b: 0 } },
      })
        .png()
        .toFile(testImagePath);

      const base64 = await cropCandidateImage(testImagePath, {
        left: 0,
        top: 0,
        right: 300,
        bottom: 300,
      });

      const buffer = Buffer.from(base64, "base64");
      const metadata = await sharp(buffer).metadata();
      expect(metadata.width).toBeLessThanOrEqual(128);
      expect(metadata.height).toBeLessThanOrEqual(128);

      await fs.unlink(testImagePath);
    });
  });
});
