import { CacheEntry, CacheConfig, DEFAULT_CACHE_CONFIG } from "../types/index.js";
import { randomBytes } from "crypto";

export interface CacheStats {
  entryCount: number;
  totalSizeBytes: number;
  typeBreakdown: Record<string, number>;
  config: CacheConfig;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  generateId(type: string): string {
    const hash = randomBytes(4).toString("hex");
    const timestamp = Date.now();
    return `${type}-${hash}-${timestamp}`;
  }

  set<T>(id: string, data: T, type: string, ttlMs?: number): void {
    const now = Date.now();
    const sizeBytes = JSON.stringify(data).length;

    // LRU eviction
    while (this.cache.size >= this.config.maxEntries) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + (ttlMs ?? this.config.defaultTtlMs),
      metadata: {
        createdAt: now,
        type,
        sizeBytes,
      },
    };

    this.cache.set(id, entry);
    this.accessOrder.push(id);
  }

  get<T>(id: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(id) as CacheEntry<T> | undefined;

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(id);
      this.accessOrder = this.accessOrder.filter((k) => k !== id);
      return undefined;
    }

    // Update access order for LRU
    this.accessOrder = this.accessOrder.filter((k) => k !== id);
    this.accessOrder.push(id);

    return entry;
  }

  clear(id: string): void {
    this.cache.delete(id);
    this.accessOrder = this.accessOrder.filter((k) => k !== id);
  }

  clearAll(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  invalidateByType(type: string): void {
    for (const [id, entry] of this.cache.entries()) {
      if (entry.metadata.type === type) {
        this.cache.delete(id);
      }
    }
    this.accessOrder = this.accessOrder.filter((id) => this.cache.has(id));
  }

  getStats(): CacheStats {
    const typeBreakdown: Record<string, number> = {};
    let totalSizeBytes = 0;

    for (const entry of this.cache.values()) {
      const type = entry.metadata.type;
      typeBreakdown[type] = (typeBreakdown[type] ?? 0) + 1;
      totalSizeBytes += entry.metadata.sizeBytes ?? 0;
    }

    return {
      entryCount: this.cache.size,
      totalSizeBytes,
      typeBreakdown,
      config: this.config,
    };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
