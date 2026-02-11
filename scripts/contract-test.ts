/**
 * Contract test harness: validates tool responses against output schemas.
 *
 * Usage: tsx scripts/contract-test.ts
 *
 * Loads fixture files from tests/fixtures/contracts/*.json,
 * calls each tool handler directly, and validates the response
 * shape against the corresponding Zod output schema.
 *
 * Exit 0 if all pass, 1 if any fail.
 */

import { readdirSync, readFileSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// Tool handlers
import { handleCacheTool } from "../src/tools/cache.js";
import { handleRtfmTool } from "../src/tools/rtfm.js";

// Output schemas (named, not unions — for fixture expectedShape matching)
import {
  CacheGetStatsOutput,
  CacheClearKeyOutput,
  CacheClearAllOutput,
  CacheGetConfigOutput,
} from "../src/types/schemas/cache-output.js";
import { RtfmOutput } from "../src/types/schemas/rtfm-output.js";

// Services needed for deterministic tools
import { CacheManager } from "../src/services/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../tests/fixtures/contracts");

/**
 * Registry of schema names to Zod schemas for validation.
 */
const schemaRegistry: Record<string, z.ZodType<unknown>> = {
  CacheGetStatsOutput,
  CacheClearKeyOutput,
  CacheClearAllOutput,
  CacheGetConfigOutput,
  RtfmOutput,
};

/**
 * Registry of tool handlers that can be tested deterministically.
 * Each handler receives (input, ...deps) and returns a result.
 */
type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

function createToolHandlers(): Record<string, ToolHandler> {
  const cache = new CacheManager();

  return {
    cache: (input) => handleCacheTool(input as Parameters<typeof handleCacheTool>[0], cache),
    rtfm: (input) => handleRtfmTool(input as Parameters<typeof handleRtfmTool>[0]),
  };
}

interface FixtureCase {
  name: string;
  input: Record<string, unknown>;
  expectedShape: string;
}

interface FixtureFile {
  tool: string;
  cases: FixtureCase[];
}

interface TestResult {
  tool: string;
  caseName: string;
  passed: boolean;
  error?: string;
}

async function runContractTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const handlers = createToolHandlers();

  // Find all fixture files
  let fixtureFiles: string[];
  try {
    fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    console.error(`No fixtures directory found at ${FIXTURES_DIR}`);
    process.exit(1);
  }

  if (fixtureFiles.length === 0) {
    console.error("No fixture files found.");
    process.exit(1);
  }

  for (const file of fixtureFiles) {
    const filePath = join(FIXTURES_DIR, file);
    const fixture: FixtureFile = JSON.parse(readFileSync(filePath, "utf-8"));
    const toolName = fixture.tool;
    const handler = handlers[toolName];

    if (!handler) {
      console.warn(`  Skipping ${toolName}: no deterministic handler available`);
      continue;
    }

    for (const testCase of fixture.cases) {
      const schema = schemaRegistry[testCase.expectedShape];

      if (!schema) {
        results.push({
          tool: toolName,
          caseName: testCase.name,
          passed: false,
          error: `Unknown schema: ${testCase.expectedShape}`,
        });
        continue;
      }

      try {
        const result = await handler(testCase.input);
        const parseResult = schema.safeParse(result);

        if (parseResult.success) {
          results.push({
            tool: toolName,
            caseName: testCase.name,
            passed: true,
          });
        } else {
          const issues = (parseResult as { error: z.ZodError }).error.issues
            .map((i) => `  ${i.path.join(".")}: ${i.message}`)
            .join("\n");
          results.push({
            tool: toolName,
            caseName: testCase.name,
            passed: false,
            error: `Schema validation failed:\n${issues}`,
          });
        }
      } catch (err) {
        results.push({
          tool: toolName,
          caseName: testCase.name,
          passed: false,
          error: `Handler threw: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  return results;
}

// Run tests and report
const results = await runContractTests();

let passed = 0;
let failed = 0;

console.log("\nContract Test Results");
console.log("====================\n");

for (const result of results) {
  if (result.passed) {
    passed++;
    console.log(`  PASS  ${result.tool} > ${result.caseName}`);
  } else {
    failed++;
    console.log(`  FAIL  ${result.tool} > ${result.caseName}`);
    console.log(`        ${result.error}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);

process.exit(failed > 0 ? 1 : 0);
