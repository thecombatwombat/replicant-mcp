import { Command } from "commander";
import { CacheManager } from "../services/index.js";

const cache = new CacheManager();

export function createCacheCommand(): Command {
  const cacheCmd = new Command("cache").description("Manage output cache");

  // Stats subcommand
  cacheCmd
    .command("stats")
    .description("Show cache statistics")
    .option("--json", "Output as JSON")
    .action((options) => {
      try {
        const stats = cache.getStats();

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log("Cache Statistics");
          console.log("================");
          console.log(`Entries: ${stats.entryCount}`);
          console.log(`Total size: ${formatBytes(stats.totalSizeBytes)}`);
          console.log(`Max entries: ${stats.config.maxEntries}`);
          console.log(`Default TTL: ${formatMs(stats.config.defaultTtlMs)}`);

          if (Object.keys(stats.typeBreakdown).length > 0) {
            console.log("\nBy type:");
            for (const [type, count] of Object.entries(stats.typeBreakdown)) {
              console.log(`  ${type}: ${count}`);
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Get subcommand
  cacheCmd
    .command("get <cacheId>")
    .description("Get cached entry by ID")
    .option("--json", "Output as JSON")
    .action((cacheId, options) => {
      try {
        const entry = cache.get(cacheId);

        if (!entry) {
          console.error(`Cache entry not found: ${cacheId}`);
          process.exit(1);
        }

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                id: cacheId,
                data: entry.data,
                metadata: entry.metadata,
                expiresAt: entry.expiresAt,
              },
              null,
              2
            )
          );
        } else {
          console.log(`Cache ID: ${cacheId}`);
          console.log(`Type: ${entry.metadata.type}`);
          console.log(`Created: ${new Date(entry.metadata.createdAt).toISOString()}`);
          console.log(`Expires: ${new Date(entry.expiresAt).toISOString()}`);
          console.log(`Size: ${formatBytes(entry.metadata.sizeBytes ?? 0)}`);
          console.log("\nData:");
          console.log(JSON.stringify(entry.data, null, 2));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Clear subcommand
  cacheCmd
    .command("clear")
    .description("Clear all cached data")
    .option("--json", "Output as JSON")
    .action((options) => {
      try {
        const statsBefore = cache.getStats();
        const entriesCleared = statsBefore.entryCount;

        cache.clearAll();

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                cleared: true,
                entriesCleared,
              },
              null,
              2
            )
          );
        } else {
          console.log(`Cleared ${entriesCleared} cache entries`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  return cacheCmd;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(0)}m`;
}
