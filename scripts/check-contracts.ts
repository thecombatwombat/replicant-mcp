/**
 * Checks that the contract file is not stale.
 *
 * Usage: tsx scripts/check-contracts.ts
 *
 * Regenerates the contract in memory and compares it to the on-disk version.
 * Exits with code 1 if they differ (ignoring the generatedAt timestamp).
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateContract } from "./generate-contract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dirname, "../docs/contracts/replicant-mcp.contract.json");

function stripTimestamp(contract: Record<string, unknown>): Record<string, unknown> {
  const { generatedAt: _, ...rest } = contract;
  return rest;
}

let existingRaw: string;
try {
  existingRaw = readFileSync(CONTRACT_PATH, "utf-8");
} catch {
  console.error("ERROR: Contract file not found at", CONTRACT_PATH);
  console.error("Run 'npm run generate:contracts' to create it.");
  process.exit(1);
}

let existing: Record<string, unknown>;
try {
  existing = JSON.parse(existingRaw);
} catch {
  console.error("ERROR: Contract file is not valid JSON.");
  process.exit(1);
}

const fresh = generateContract();

const existingStripped = JSON.stringify(stripTimestamp(existing), null, 2);
const freshStripped = JSON.stringify(stripTimestamp(fresh), null, 2);

if (existingStripped === freshStripped) {
  console.log("Contract is up to date.");
  process.exit(0);
} else {
  console.error("ERROR: Contract file is stale.");
  console.error("Run 'npm run generate:contracts' to update it.");
  process.exit(1);
}
