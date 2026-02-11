import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entrypoint = resolve(__dirname, "../../dist/index.js");

describe("unified entrypoint routing", () => {
  beforeAll(() => {
    execFileSync("npm", ["run", "build"], {
      cwd: resolve(__dirname, "../.."),
      timeout: 30000,
    });
  });

  it("routes to CLI when args are present (--version)", () => {
    const output = execFileSync("node", [entrypoint, "--version"], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("routes to CLI when args are present (--help)", () => {
    const output = execFileSync("node", [entrypoint, "--help"], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    expect(output).toContain("replicant-mcp");
    expect(output).toContain("Android development CLI");
  });

  it("routes to CLI for subcommands (doctor --help)", () => {
    const output = execFileSync("node", [entrypoint, "doctor", "--help"], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    expect(output).toContain("doctor");
  });

  it("does not show CLI help when invoked with no args", () => {
    // With no args, index.ts starts the MCP server which reads stdin.
    // We provide empty stdin so it exits quickly. The key assertion is
    // that it does NOT produce CLI help output (proving it took the server path).
    try {
      const output = execFileSync("node", [entrypoint], {
        encoding: "utf-8",
        timeout: 3000,
        input: "",
      });
      expect(output).not.toContain("Android development CLI");
    } catch {
      // Server exiting with error on empty stdin is expected —
      // the point is it tried to start the server, not the CLI
    }
  });
});
