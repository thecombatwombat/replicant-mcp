import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateTokenSnapshot } from "../../scripts/generate-token-snapshot.js";

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

  it("records per-tool entries for every registered tool", () => {
    const fresh = generateTokenSnapshot();
    const toolCount = Object.keys(fresh.perTool).length;
    expect(toolCount).toBe(14);
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
