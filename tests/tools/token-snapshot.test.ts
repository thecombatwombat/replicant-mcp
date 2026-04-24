import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateTokenSnapshot } from "../../scripts/generate-token-snapshot.js";
import { ALL_TOOL_DEFINITIONS } from "../../src/tools/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(
  __dirname,
  "../../docs/contracts/tool-schema-tokens.json",
);

function stripTimestamp(s: Record<string, unknown>): Record<string, unknown> {
  const { generatedAt: _, ...rest } = s;
  return rest;
}

describe("tool-schema token snapshot", () => {
  const onDisk = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8")) as Record<
    string,
    unknown
  >;

  it("on-disk snapshot matches the fresh generation (drift guard)", () => {
    const fresh = generateTokenSnapshot() as unknown as Record<string, unknown>;
    expect(stripTimestamp(onDisk)).toEqual(stripTimestamp(fresh));
  });

  it("records per-tool entries for every tool in ALL_TOOL_DEFINITIONS (Codex P2)", () => {
    // Protects against a tool being added to the server registry but not
    // picked up by the snapshot generator — previously possible when the
    // generator maintained its own hand-written list.
    const fresh = generateTokenSnapshot();
    const snapshotNames = Object.keys(fresh.perTool).sort();
    const registryNames = ALL_TOOL_DEFINITIONS.map((d) => d.name).sort();
    expect(snapshotNames).toEqual(registryNames);
  });

  it("total chars equal instructionsChars + schemaChars", () => {
    const fresh = generateTokenSnapshot();
    expect(fresh.totalChars).toBe(
      fresh.instructionsChars + fresh.schemaChars,
    );
  });

  it("estimatedTokens is derived from totalChars and charsPerToken", () => {
    const fresh = generateTokenSnapshot();
    expect(fresh.estimatedTokens).toBe(
      Math.ceil(fresh.totalChars / fresh.charsPerToken),
    );
  });
});
