/**
 * Checks that the tool-schema token snapshot is not stale.
 *
 * Usage: tsx scripts/check-token-snapshot.ts
 *
 * Regenerates the snapshot in memory and compares it to the on-disk version.
 * Exits with code 1 if they differ (ignoring the generatedAt timestamp).
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateTokenSnapshot } from "./generate-token-snapshot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(
  __dirname,
  "../docs/contracts/tool-schema-tokens.json",
);

function stripTimestamp(snapshot: Record<string, unknown>): Record<string, unknown> {
  const { generatedAt: _, ...rest } = snapshot;
  return rest;
}

let existingRaw: string;
try {
  existingRaw = readFileSync(SNAPSHOT_PATH, "utf-8");
} catch {
  console.error("ERROR: Token snapshot not found at", SNAPSHOT_PATH);
  console.error("Run 'npm run generate:contracts' to create it.");
  process.exit(1);
}

let existing: Record<string, unknown>;
try {
  existing = JSON.parse(existingRaw);
} catch {
  console.error("ERROR: Token snapshot is not valid JSON.");
  process.exit(1);
}

const fresh = generateTokenSnapshot();

const existingStripped = JSON.stringify(stripTimestamp(existing), null, 2);
const freshStripped = JSON.stringify(
  stripTimestamp(fresh as unknown as Record<string, unknown>),
  null,
  2,
);

if (existingStripped === freshStripped) {
  console.log("Token snapshot is up to date.");
  process.exit(0);
} else {
  const existingTokens = (existing as { estimatedTokens?: number })
    .estimatedTokens;
  const freshTokens = fresh.estimatedTokens;
  const delta =
    typeof existingTokens === "number" ? freshTokens - existingTokens : null;
  console.error("ERROR: Token snapshot is stale.");
  if (delta !== null) {
    const sign = delta >= 0 ? "+" : "";
    console.error(
      `  Estimated tokens: ${existingTokens} → ${freshTokens} (${sign}${delta})`,
    );
  }
  console.error("Run 'npm run generate:contracts' to update it.");
  process.exit(1);
}
