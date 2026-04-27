import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("THE-100: npm test wires the contract guard locally", () => {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "../../package.json"), "utf-8"),
  ) as { scripts: Record<string, string> };

  it("`npm test` runs vitest one-shot and a posttest hook fires the contract check", () => {
    // Must one-shot (no watcher).
    expect(pkg.scripts.test).toMatch(/vitest --run/);
    // The contract check runs in posttest (not chained with &&) so `npm test --`
    // args reach vitest and don't drift to the contract check.
    expect(pkg.scripts.posttest).toMatch(/check:contracts/);
    expect(pkg.scripts.test).not.toMatch(/check:contracts/);
  });

  it("provides `npm run test:watch` for daily dev", () => {
    expect(pkg.scripts["test:watch"]).toBeDefined();
    expect(pkg.scripts["test:watch"]).toMatch(/vitest/);
  });

  it("`npm run check:contracts` exists and points at both snapshot scripts", () => {
    expect(pkg.scripts["check:contracts"]).toMatch(/check-contracts/);
    expect(pkg.scripts["check:contracts"]).toMatch(/check-token-snapshot/);
  });
});
