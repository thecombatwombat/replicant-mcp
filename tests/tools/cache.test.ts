import { describe, it, expect, beforeEach } from "vitest";
import { handleCacheTool } from "../../src/tools/cache.js";
import { CacheManager } from "../../src/services/index.js";

describe("cache tool", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager();
  });

  it("returns stats", async () => {
    cache.set("test-1", { data: 1 }, "test");
    const result = await handleCacheTool({ operation: "get-stats" }, cache);
    expect(result.stats.entryCount).toBe(1);
  });

  it("clears specific key", async () => {
    cache.set("test-1", { data: 1 }, "test");
    await handleCacheTool({ operation: "clear", key: "test-1" }, cache);
    expect(cache.get("test-1")).toBeUndefined();
  });

  it("clears all", async () => {
    cache.set("test-1", { data: 1 }, "test");
    cache.set("test-2", { data: 2 }, "test");
    await handleCacheTool({ operation: "clear" }, cache);
    expect(cache.getStats().entryCount).toBe(0);
  });

  it("gets config", async () => {
    const result = await handleCacheTool({ operation: "get-config" }, cache);
    expect(result.config.maxEntries).toBeDefined();
  });

  it("sets config", async () => {
    await handleCacheTool({ operation: "set-config", config: { maxEntries: 50 } }, cache);
    expect(cache.getConfig().maxEntries).toBe(50);
  });
});
