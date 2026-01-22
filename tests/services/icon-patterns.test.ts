import { describe, it, expect } from "vitest";
import { matchIconPattern, ICON_PATTERNS } from "../../src/services/icon-patterns.js";

describe("icon-patterns", () => {
  describe("matchIconPattern", () => {
    it("returns pattern names for exact query match", () => {
      expect(matchIconPattern("overflow")).toEqual(["overflow", "more", "options", "menu", "dots", "kabob", "meatball"]);
    });

    it("returns pattern names for partial query match", () => {
      expect(matchIconPattern("overflow menu")).toEqual(["overflow", "more", "options", "menu", "dots", "kabob", "meatball"]);
    });

    it("returns null for unknown query", () => {
      expect(matchIconPattern("xyzabc123")).toBeNull();
    });

    it("matches back button variants", () => {
      const patterns = matchIconPattern("back");
      expect(patterns).toContain("back");
      expect(patterns).toContain("navigate_up");
      expect(patterns).toContain("arrow_back");
    });

    it("is case insensitive", () => {
      expect(matchIconPattern("SEARCH")).toEqual(matchIconPattern("search"));
    });
  });

  describe("ICON_PATTERNS", () => {
    it("has at least 15 icon categories", () => {
      expect(Object.keys(ICON_PATTERNS).length).toBeGreaterThanOrEqual(15);
    });
  });
});
