/**
 * Behavioral tests for marketplace distribution config files.
 *
 * Validates that all config files required for MCP marketplace listings
 * exist on disk with correct structure, values, and cross-file consistency.
 *
 * Requirements covered: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, CFG-06
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function readJson(relPath: string): unknown {
  const fullPath = resolve(root, relPath);
  return JSON.parse(readFileSync(fullPath, "utf8"));
}

function readText(relPath: string): string {
  return readFileSync(resolve(root, relPath), "utf8");
}

// CFG-01: .mcp/server.json has valid MCP Registry schema
describe("CFG-01: .mcp/server.json — MCP Registry schema and metadata", () => {
  let server: Record<string, unknown>;

  beforeAll(() => {
    server = readJson(".mcp/server.json") as Record<string, unknown>;
  });

  it("file exists and parses as valid JSON", () => {
    expect(() => readJson(".mcp/server.json")).not.toThrow();
  });

  it("has $schema pointing to MCP Registry schema URL", () => {
    expect(server.$schema).toBe(
      "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"
    );
  });

  it("name is the correct MCP Registry identifier", () => {
    expect(server.name).toBe("io.github.thecombatwombat/replicant-mcp");
  });

  it("description exists and is non-empty", () => {
    expect(typeof server.description).toBe("string");
    expect((server.description as string).length).toBeGreaterThan(0);
  });

  it("description is within MCP Registry 100-character limit", () => {
    expect((server.description as string).length).toBeLessThanOrEqual(100);
  });

  it("version field is present and semver-shaped", () => {
    expect(typeof server.version).toBe("string");
    expect(server.version as string).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("packages array is present with at least one entry", () => {
    const packages = server.packages as unknown[];
    expect(Array.isArray(packages)).toBe(true);
    expect(packages.length).toBeGreaterThan(0);
  });

  it("first package uses stdio transport", () => {
    const packages = server.packages as Array<Record<string, unknown>>;
    const transport = packages[0].transport as Record<string, unknown>;
    expect(transport.type).toBe("stdio");
  });

  it("repository url points to thecombatwombat/replicant-mcp", () => {
    const repo = server.repository as Record<string, string>;
    expect(repo.url).toContain("thecombatwombat/replicant-mcp");
  });
});

// CFG-02: package.json mcpName matches .mcp/server.json name exactly
describe("CFG-02: package.json mcpName matches .mcp/server.json name", () => {
  it("package.json has mcpName field", () => {
    const pkg = readJson("package.json") as Record<string, unknown>;
    expect(pkg.mcpName).toBeDefined();
    expect(typeof pkg.mcpName).toBe("string");
  });

  it("package.json mcpName exactly matches .mcp/server.json name", () => {
    const pkg = readJson("package.json") as Record<string, unknown>;
    const server = readJson(".mcp/server.json") as Record<string, unknown>;
    expect(pkg.mcpName).toBe(server.name);
  });

  it("mcpName value is the expected registry identifier", () => {
    const pkg = readJson("package.json") as Record<string, unknown>;
    expect(pkg.mcpName).toBe("io.github.thecombatwombat/replicant-mcp");
  });
});

// CFG-03: smithery.yaml has valid YAML, stdio transport, commandFunction with replicant-mcp@latest
describe("CFG-03: smithery.yaml — Smithery marketplace config", () => {
  let config: Record<string, unknown>;

  beforeAll(() => {
    config = parseYaml(readText("smithery.yaml")) as Record<string, unknown>;
  });

  it("file exists and parses as valid YAML", () => {
    expect(() => parseYaml(readText("smithery.yaml"))).not.toThrow();
  });

  it("startCommand is present", () => {
    expect(config.startCommand).toBeDefined();
  });

  it("transport type is stdio", () => {
    const startCommand = config.startCommand as Record<string, unknown>;
    expect(startCommand.type).toBe("stdio");
  });

  it("commandFunction is present", () => {
    const startCommand = config.startCommand as Record<string, unknown>;
    expect(startCommand.commandFunction).toBeDefined();
    expect(typeof startCommand.commandFunction).toBe("string");
  });

  it("commandFunction references replicant-mcp@latest", () => {
    const startCommand = config.startCommand as Record<string, unknown>;
    expect(startCommand.commandFunction as string).toContain(
      "replicant-mcp@latest"
    );
  });

  it("configSchema is present (optional but expected per plan)", () => {
    const startCommand = config.startCommand as Record<string, unknown>;
    expect(startCommand.configSchema).toBeDefined();
  });

  it("configSchema defines projectRoot property", () => {
    const startCommand = config.startCommand as Record<string, unknown>;
    const schema = startCommand.configSchema as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown>;
    expect(properties.projectRoot).toBeDefined();
  });
});

// CFG-04: glama.json has valid JSON, $schema URL pointing to glama.ai, thecombatwombat maintainer
describe("CFG-04: glama.json — Glama marketplace ownership claim", () => {
  let glama: Record<string, unknown>;

  beforeAll(() => {
    glama = readJson("glama.json") as Record<string, unknown>;
  });

  it("file exists and parses as valid JSON", () => {
    expect(() => readJson("glama.json")).not.toThrow();
  });

  it("has $schema pointing to glama.ai", () => {
    expect(typeof glama.$schema).toBe("string");
    expect(glama.$schema as string).toContain("glama.ai");
  });

  it("maintainers array is present", () => {
    expect(Array.isArray(glama.maintainers)).toBe(true);
  });

  it("maintainers includes thecombatwombat", () => {
    const maintainers = glama.maintainers as string[];
    expect(maintainers).toContain("thecombatwombat");
  });
});

// CFG-05: .cursor-plugin/plugin.json has name, description, keywords, mcpServers referencing .mcp.json
describe("CFG-05: .cursor-plugin/plugin.json — Cursor marketplace manifest", () => {
  let plugin: Record<string, unknown>;

  beforeAll(() => {
    plugin = readJson(".cursor-plugin/plugin.json") as Record<string, unknown>;
  });

  it("file exists and parses as valid JSON", () => {
    expect(() => readJson(".cursor-plugin/plugin.json")).not.toThrow();
  });

  it("has name field", () => {
    expect(typeof plugin.name).toBe("string");
    expect((plugin.name as string).length).toBeGreaterThan(0);
  });

  it("has description field", () => {
    expect(typeof plugin.description).toBe("string");
    expect((plugin.description as string).length).toBeGreaterThan(0);
  });

  it("has keywords array with at least one entry", () => {
    expect(Array.isArray(plugin.keywords)).toBe(true);
    expect((plugin.keywords as string[]).length).toBeGreaterThan(0);
  });

  it("mcpServers field references .mcp.json", () => {
    expect(plugin.mcpServers).toBe(".mcp.json");
  });
});

// CFG-06: .mcp.json has valid MCP server config with replicant-mcp@latest and is NOT gitignored
describe("CFG-06: .mcp.json — MCP server config is present and trackable", () => {
  let mcpConfig: Record<string, unknown>;

  beforeAll(() => {
    mcpConfig = readJson(".mcp.json") as Record<string, unknown>;
  });

  it("file exists and parses as valid JSON", () => {
    expect(() => readJson(".mcp.json")).not.toThrow();
  });

  it("mcpServers object is present", () => {
    expect(mcpConfig.mcpServers).toBeDefined();
    expect(typeof mcpConfig.mcpServers).toBe("object");
  });

  it("mcpServers has replicant-mcp entry", () => {
    const servers = mcpConfig.mcpServers as Record<string, unknown>;
    expect(servers["replicant-mcp"]).toBeDefined();
  });

  it("replicant-mcp entry uses npx command", () => {
    const servers = mcpConfig.mcpServers as Record<string, unknown>;
    const entry = servers["replicant-mcp"] as Record<string, unknown>;
    expect(entry.command).toBe("npx");
  });

  it("replicant-mcp entry references replicant-mcp@latest in args", () => {
    const servers = mcpConfig.mcpServers as Record<string, unknown>;
    const entry = servers["replicant-mcp"] as Record<string, unknown>;
    const args = entry.args as string[];
    expect(args).toContain("replicant-mcp@latest");
  });

  it(".mcp.json is NOT gitignored", () => {
    // spawnSync avoids shell — args are never interpolated.
    // git check-ignore exits 0 when file IS ignored, 1 when NOT ignored.
    // We want exit code 1 (not ignored).
    const result = spawnSync("git", ["check-ignore", ".mcp.json"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
  });
});
