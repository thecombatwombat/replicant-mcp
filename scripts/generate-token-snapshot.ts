/**
 * Generates a snapshot of the tool-schema token footprint.
 *
 * Usage: tsx scripts/generate-token-snapshot.ts
 *
 * Output: docs/contracts/tool-schema-tokens.json
 *
 * The snapshot records the estimated token cost of every tool's wire-format
 * JSON Schema plus the server-level instructions string. It's committed to
 * git so PRs that touch tool schemas show a readable delta (+35 tokens /
 * -15 tokens) instead of only "still under the ceiling."
 *
 * The ceiling lives in tests/tools/token-budget.test.ts and is the guardrail
 * that blocks uncontrolled growth. This snapshot is the visibility layer;
 * they're independent by design.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { ALL_TOOL_DEFINITIONS } from "../src/tools/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(
  __dirname,
  "../docs/contracts/tool-schema-tokens.json",
);

// Must match the instructions string used by the MCP server registration
// and by tests/tools/token-budget.test.ts. Kept inline (no import) so this
// script stays a pure contract of what the wire will cost.
const INSTRUCTIONS =
  "Use these tools for Android — never raw adb/gradle/emulator commands. Auto-selects single device. Start: `adb-device list`. Docs: `rtfm`.";

// Rough token estimate: ~4 chars per token for JSON schema payloads. Matches
// the heuristic used in tests/tools/token-budget.test.ts.
const CHARS_PER_TOKEN = 4;

const toolDefinitions = ALL_TOOL_DEFINITIONS;

interface PerToolEntry {
  chars: number;
  estTokens: number;
}

interface Snapshot {
  version: string;
  generatedAt: string;
  charsPerToken: number;
  instructionsChars: number;
  schemaChars: number;
  totalChars: number;
  estimatedTokens: number;
  perTool: Record<string, PerToolEntry>;
}

export function generateTokenSnapshot(): Snapshot {
  const schemaJson = JSON.stringify(toolDefinitions);
  const schemaChars = schemaJson.length;
  const instructionsChars = INSTRUCTIONS.length;
  const totalChars = schemaChars + instructionsChars;

  const perTool: Record<string, PerToolEntry> = {};
  for (const def of toolDefinitions) {
    const chars = JSON.stringify(def).length;
    perTool[def.name] = {
      chars,
      estTokens: Math.ceil(chars / CHARS_PER_TOKEN),
    };
  }

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    charsPerToken: CHARS_PER_TOKEN,
    instructionsChars,
    schemaChars,
    totalChars,
    estimatedTokens: Math.ceil(totalChars / CHARS_PER_TOKEN),
    perTool,
  };
}

// Only write when executed directly (not when imported).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const snapshot = generateTokenSnapshot();
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Token snapshot generated: ${SNAPSHOT_PATH}`);
  console.log(
    `Total: ${snapshot.totalChars} chars / ~${snapshot.estimatedTokens} tokens across ${Object.keys(snapshot.perTool).length} tools`,
  );
}
