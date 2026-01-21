import { Command } from "commander";
import { GradleAdapter } from "../adapters/index.js";
import { CacheManager } from "../services/index.js";
import {
  formatBuildSuccess,
  formatBuildFailure,
  formatTestResults,
} from "./formatter.js";
import { CACHE_TTLS, ReplicantError } from "../types/index.js";

const adapter = new GradleAdapter();
const cache = new CacheManager();

export function createGradleCommand(): Command {
  const gradle = new Command("gradle").description("Build and test Android apps");

  // Build subcommand
  gradle
    .command("build")
    .description("Build the Android project")
    .option(
      "-o, --operation <type>",
      "Build operation (assembleDebug, assembleRelease, bundle)",
      "assembleDebug"
    )
    .option("-m, --module <name>", "Target module")
    .option("-f, --flavor <name>", "Build flavor")
    .option("--json", "Output full JSON result")
    .action(async (options) => {
      try {
        const startTime = Date.now();
        const { result, fullOutput } = await adapter.build(
          options.operation as "assembleDebug" | "assembleRelease" | "bundle",
          options.module,
          options.flavor
        );
        const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

        const cacheId = cache.generateId("build");
        cache.set(cacheId, { result, fullOutput }, "build", CACHE_TTLS.BUILD_OUTPUT);

        if (options.json) {
          console.log(JSON.stringify({ result, cacheId }, null, 2));
        } else {
          console.log(
            formatBuildSuccess({
              duration,
              apkPath: result.apkPath,
              warnings: result.warnings,
              cacheId,
            })
          );
        }
      } catch (error) {
        const duration = "0s";
        const cacheId = cache.generateId("build");

        if (error instanceof ReplicantError && error.details?.buildResult) {
          cache.set(
            cacheId,
            { result: error.details.buildResult, fullOutput: "" },
            "build",
            CACHE_TTLS.BUILD_OUTPUT
          );

          if (options.json) {
            console.log(
              JSON.stringify({ error: error.message, result: error.details.buildResult, cacheId }, null, 2)
            );
          } else {
            console.log(
              formatBuildFailure({
                duration,
                error: error.message,
                cacheId,
              })
            );
          }
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error: ${errorMessage}`);
        }
        process.exit(1);
      }
    });

  // Test subcommand
  gradle
    .command("test")
    .description("Run tests")
    .option(
      "-o, --operation <type>",
      "Test type (unitTest, connectedTest)",
      "unitTest"
    )
    .option("-m, --module <name>", "Target module")
    .option("-f, --filter <pattern>", "Test filter pattern")
    .option("--json", "Output full JSON result")
    .action(async (options) => {
      try {
        const startTime = Date.now();
        const { result, fullOutput } = await adapter.test(
          options.operation as "unitTest" | "connectedTest",
          options.module,
          options.filter
        );
        const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

        const cacheId = cache.generateId("test");
        cache.set(cacheId, { result, fullOutput }, "test", CACHE_TTLS.TEST_RESULTS);

        if (options.json) {
          console.log(JSON.stringify({ result, cacheId }, null, 2));
        } else {
          console.log(
            formatTestResults({
              passed: result.passed,
              failed: result.failed,
              skipped: result.skipped,
              duration,
              failures: result.failures.map((f) => `${f.test}: ${f.message}`),
              cacheId,
            })
          );
        }

        if (result.failed > 0) {
          process.exit(1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // List subcommand
  gradle
    .command("list")
    .description("List modules, variants, or tasks")
    .option("-t, --type <type>", "What to list (modules, variants, tasks)", "modules")
    .option("-m, --module <name>", "Target module (for variants/tasks)")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        let result: string[] | { name: string; buildType: string; flavors: string[] }[];

        switch (options.type) {
          case "modules":
            result = await adapter.listModules();
            break;
          case "variants":
            result = await adapter.listVariants(options.module);
            break;
          case "tasks":
            result = await adapter.listTasks(options.module);
            break;
          default:
            console.error(`Unknown list type: ${options.type}`);
            process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (options.type === "variants") {
            const variants = result as { name: string; buildType: string; flavors: string[] }[];
            console.log("Variants:");
            variants.forEach((v) => {
              const flavors = v.flavors.length > 0 ? ` (flavors: ${v.flavors.join(", ")})` : "";
              console.log(`  ${v.name} [${v.buildType}]${flavors}`);
            });
          } else {
            const items = result as string[];
            console.log(`${options.type.charAt(0).toUpperCase() + options.type.slice(1)}:`);
            items.forEach((item) => console.log(`  ${item}`));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Details subcommand
  gradle
    .command("details <cacheId>")
    .description("Get details from a cached build/test result")
    .option("--errors", "Show only errors")
    .option("--warnings", "Show only warnings")
    .option("--json", "Output as JSON")
    .action((cacheId, options) => {
      try {
        const entry = cache.get<{ result: unknown; fullOutput: string }>(cacheId);

        if (!entry) {
          console.error(`Cache entry not found: ${cacheId}`);
          console.error("Cache entries expire after 30 minutes.");
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(entry.data, null, 2));
          return;
        }

        const output = entry.data.fullOutput;

        if (options.errors) {
          const errorLines = output
            .split("\n")
            .filter((line) => /error:|FAILED|Exception/i.test(line));
          console.log("Errors:");
          errorLines.forEach((line) => console.log(line));
        } else if (options.warnings) {
          const warningLines = output
            .split("\n")
            .filter((line) => /warning:|warn:/i.test(line));
          console.log("Warnings:");
          warningLines.forEach((line) => console.log(line));
        } else {
          console.log(output);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  return gradle;
}
