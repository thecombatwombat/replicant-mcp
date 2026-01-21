import { describe, it, expect, beforeEach } from "vitest";
import { CacheManager } from "../../src/services/cache-manager.js";

describe("CacheManager", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ maxEntries: 3, maxEntrySizeBytes: 1024, defaultTtlMs: 1000 });
  });

  describe("set and get", () => {
    it("stores and retrieves a value", () => {
      cache.set("test-id", { data: "hello" }, "test");
      const result = cache.get("test-id");
      expect(result?.data).toEqual({ data: "hello" });
    });

    it("returns undefined for missing keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("returns undefined for expired entries", async () => {
      cache.set("test-id", { data: "hello" }, "test", 10); // 10ms TTL
      await new Promise((r) => setTimeout(r, 50));
      expect(cache.get("test-id")).toBeUndefined();
    });
  });

  describe("generateId", () => {
    it("generates unique IDs with type prefix", () => {
      const id1 = cache.generateId("build");
      const id2 = cache.generateId("build");
      expect(id1).toMatch(/^build-[a-z0-9]+-\d+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when maxEntries exceeded", () => {
      cache.set("a", { v: 1 }, "test");
      cache.set("b", { v: 2 }, "test");
      cache.set("c", { v: 3 }, "test");
      cache.set("d", { v: 4 }, "test"); // Should evict "a"

      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeDefined();
      expect(cache.get("c")).toBeDefined();
      expect(cache.get("d")).toBeDefined();
    });
  });

  describe("invalidation", () => {
    it("clears specific key", () => {
      cache.set("test-id", { data: "hello" }, "test");
      cache.clear("test-id");
      expect(cache.get("test-id")).toBeUndefined();
    });

    it("clears all entries", () => {
      cache.set("a", { v: 1 }, "test");
      cache.set("b", { v: 2 }, "test");
      cache.clearAll();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
    });

    it("invalidates by type", () => {
      cache.set("build-1", { v: 1 }, "build");
      cache.set("test-1", { v: 2 }, "test");
      cache.invalidateByType("build");
      expect(cache.get("build-1")).toBeUndefined();
      expect(cache.get("test-1")).toBeDefined();
    });
  });

  describe("stats", () => {
    it("returns cache statistics", () => {
      cache.set("a", { v: 1 }, "build");
      cache.set("b", { v: 2 }, "test");
      const stats = cache.getStats();
      expect(stats.entryCount).toBe(2);
      expect(stats.typeBreakdown).toEqual({ build: 1, test: 1 });
    });
  });
});
